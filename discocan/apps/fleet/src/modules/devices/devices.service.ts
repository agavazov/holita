import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type ServiceUnavailableException,
} from '@nestjs/common';
import { requireRole } from '../../auth/roles.js';
import { runFleetActions } from '../../fleet-actions.js';
import { FleetClock } from '../../clock/fleet-clock.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import type { InspectionState } from '../../integrations/device-adapter.js';
import type {
  CreateFleetDeviceInput,
  FleetDevice,
  FleetDevicePage,
  FleetDeviceRouting,
  FleetErmDevice,
  FleetDeviceSortField,
  FleetDeviceActionResult,
  FleetDeviceSummary,
  FleetDeviceDiagnosticSummary,
  FleetWarningLamp,
  QueryFleetDevicesArgs,
  UpdateFleetDeviceInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumFilter,
  type FieldError,
  type FleetScope,
  idList,
  ids,
  invalid,
  pagination,
  persistenceError,
  requireScope,
  rethrowUniqueViolation,
  searchTokens,
  sortDirection,
  sortField,
  uuid,
} from '../../validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import { reportingPair, TelemetryService } from '../telemetry/telemetry.service.js';
import {
  type DeviceListCriteria,
  type DeviceRow,
  DevicesRepository,
} from './devices.repository.js';
import {
  DEVICE_MODELS,
  DEVICE_OPTIONS,
  checkOptions,
  createDeviceData,
  deviceType,
  edataModule as edataModuleInput,
  updateDeviceData,
} from './device-input.js';
import { deviceConditions } from './device-filter.js';
import { loadDeviceStates } from '../device-inspection/device-state-loader.js';
import { deviceStatus } from './device-state.js';
import { SettingsService } from '../settings/settings.service.js';
import { WARNING_LAMP_PARAMETER_IDS, warningLamp, currentWarnings } from './warning-lamps.js';

export type DeviceResult = Omit<
  FleetDevice,
  | 'branch'
  | 'state'
  | 'events'
  | 'messages'
  | 'commandRequests'
  | 'commands'
  | 'parameterSnapshots'
  | 'configurationChanges'
  | 'configurationWritesEnabled'
> & {
  state?: InspectionState | ServiceUnavailableException | null;
};
type StoredDevice = Omit<
  DeviceResult,
  'lastReportedAt' | 'status' | 'erm' | 'diagnostics' | 'warningLamps' | 'currentWarnings'
>;

const SORT_FIELDS: readonly FleetDeviceSortField[] = [
  'IMEI',
  'INSTALLED_AT',
  'CREATED_AT',
  'STATUS',
  'VEHICLE_LICENSE_PLATE',
  'LAST_REPORTED_AT',
];

const DUPLICATE_IMEI: FieldError = {
  path: 'imei',
  message: 'IMEI is already registered.',
  code: 'ALREADY_EXISTS',
};
const DUPLICATE_SERIAL_NUMBER: FieldError = {
  path: 'serialNumber',
  message: 'Serial number is already used in this branch.',
  code: 'ALREADY_EXISTS',
};
const UNIQUE_INDEXES = new Map([
  ['device_imei_key', DUPLICATE_IMEI],
  ['device_tenantId_branchId_serialNumber_key', DUPLICATE_SERIAL_NUMBER],
]);

function toDevice(row: DeviceRow): StoredDevice {
  return {
    id: row.id,
    branchId: row.branchId,
    imei: row.imei,
    type: row.type,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    model: row.model,
    serialNumber: row.serialNumber,
    options: row.options,
    firmwareVersion: row.firmwareVersion,
    simPhoneNumber: row.simPhoneNumber,
    simIccid: row.simIccid,
    smsPassword: row.smsPassword,
    installedAt: row.installedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly devices: DevicesRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
    private readonly telemetry: TelemetryService,
    private readonly settings: SettingsService,
    private readonly adapters: DeviceAdapters,
  ) {}

  private ermDevice(row: DeviceRow, freshAfter: number | null): FleetErmDevice | null {
    if (row.type !== 'ERM') {
      return null;
    }
    const edataModule = row.erm?.edataModule ?? null;
    if (freshAfter === null) {
      return { edataModule, routing: null, routingHealth: null };
    }
    const primaryReceivedAt = row.cursor?.lastReceivedAt ?? null;
    const observation = row.erm?.routingObservedAt ?? null;
    const primaryAfterObservation =
      primaryReceivedAt !== null && (observation === null || primaryReceivedAt > observation);
    const routing: FleetDeviceRouting | null = primaryAfterObservation
      ? primaryReceivedAt.getTime() >= freshAfter
        ? 'DISCOCAN'
        : null
      : observation !== null && observation.getTime() >= freshAfter
        ? (row.erm?.routing ?? null)
        : null;
    const routingHealth =
      row.erm && observation
        ? {
            backupSince: row.erm.backupSince,
            lastBackupStartedAt: row.erm.lastBackupStartedAt,
            lastBackupEndedAt: row.erm.lastBackupEndedAt,
            backupSeconds:
              row.erm.backupSeconds +
              (row.erm.backupSince === null
                ? 0
                : Math.max(
                    0,
                    Math.floor((observation.getTime() - row.erm.backupSince.getTime()) / 1000),
                  )),
          }
        : null;
    return { edataModule, routing, routingHealth };
  }

  private routingFreshAfter(rows: readonly DeviceRow[]): number | null {
    return rows.some((row) => row.type === 'ERM') && this.adapters.enabled('ERM', 'reports')
      ? this.clock.now().getTime() - 70 * 60_000
      : null;
  }

  private async diagnostics(
    scope: FleetScope,
    rows: readonly DeviceRow[],
  ): Promise<
    Map<
      string,
      {
        diagnostics: FleetDeviceDiagnosticSummary;
        warningLamps: FleetWarningLamp[];
        currentWarnings: FleetWarningLamp[];
      }
    >
  > {
    if (!rows.length) {
      return new Map();
    }
    const pairs = rows.flatMap((row) =>
      row.vehicleId === null ? [] : [{ vehicleId: row.vehicleId, imei: row.imei }],
    );
    const { latest, lamps } = await this.devices.diagnostics(
      scope,
      pairs,
      rows.map((row) => row.id),
    );
    const latestByPair = new Map(
      latest.flatMap((row) =>
        row.deviceImei === null
          ? []
          : [[reportingPair(row.vehicleId, row.deviceImei), row] as const],
      ),
    );
    return new Map(
      rows.map((row) => {
        const warningLamps = WARNING_LAMP_PARAMETER_IDS.map((parameterId) =>
          warningLamp(
            row.id,
            parameterId,
            lamps.find((lamp) => lamp.deviceId === row.id && lamp.parameterId === parameterId),
          ),
        );
        const pair = row.vehicleId === null ? null : reportingPair(row.vehicleId, row.imei);
        return [
          row.id,
          {
            diagnostics: {
              count: currentWarnings(warningLamps).length,
              latest: pair === null ? null : (latestByPair.get(pair) ?? null),
            },
            warningLamps,
            currentWarnings: currentWarnings(warningLamps),
          },
        ];
      }),
    );
  }

  async forVehicles(scope: FleetScope, vehicleIds: readonly string[]): Promise<DeviceResult[]> {
    if (!vehicleIds.length) {
      return [];
    }
    return this.complete(scope, await this.devices.forVehicles(scope, vehicleIds));
  }

  loadStates(context: RequestContext, devices: readonly DeviceResult[]): Promise<void> {
    return loadDeviceStates(this.adapters, context, devices);
  }

  async references(
    context: RequestContext,
    ids: readonly string[],
  ): Promise<Map<string, DeviceResult>> {
    const scope = requireScope(context);
    const devices = await this.complete(scope, await this.devices.forIds(scope, ids));
    await this.loadStates(context, devices);
    return new Map(devices.map((device) => [device.id, device]));
  }

  async list(
    context: RequestContext,
    args: QueryFleetDevicesArgs,
    includeState = false,
  ): Promise<Omit<FleetDevicePage, 'items'> & { items: DeviceResult[] }> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const criteria: DeviceListCriteria = {
      tokens,
      ids: selected,
      models: enumFilter(filter?.models, DEVICE_MODELS, 'models'),
      options: enumFilter(filter?.options, DEVICE_OPTIONS, 'options'),
      vehicleIds: idList(filter?.vehicleIds, 'vehicleIds'),
      allOf: deviceConditions(filter?.allOf),
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'CREATED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const page = await this.devices.list(scope, { offset, limit }, criteria, sort);
    const freshAfter = this.routingFreshAfter(page.items);
    const diagnostics = await this.diagnostics(scope, page.items);
    const items = page.items.map((row) => ({
      ...toDevice(row),
      status: row.status,
      lastReportedAt: row.lastReportedAt,
      erm: this.ermDevice(row, freshAfter),
      diagnostics: diagnostics.get(row.id)?.diagnostics ?? { count: 0, latest: null },
      warningLamps: diagnostics.get(row.id)?.warningLamps ?? [],
      currentWarnings: diagnostics.get(row.id)?.currentWarnings ?? [],
    }));
    if (includeState) {
      await this.loadStates(context, items);
    }
    return { items, total: page.total, offset, limit };
  }

  async find(context: RequestContext, id: string, includeState = false): Promise<DeviceResult> {
    const [scope, row] = await this.scopedDevice(context, id);
    return this.completeOne(scope, row, includeState ? context : undefined);
  }

  async scopedDevice(context: RequestContext, id: string): Promise<[FleetScope, DeviceRow]> {
    const scope = requireScope(context);
    const row = await this.devices.find(scope, uuid(id, 'id'));
    if (!row) {
      throw new NotFoundException('Device not found');
    }
    return [scope, row];
  }

  summary(context: RequestContext): Promise<FleetDeviceSummary> {
    return this.devices.summary(requireScope(context));
  }

  async deleteMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetDeviceActionResult> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one device.', 'REQUIRED');
    }
    return runFleetActions(selected, context, this.logger, 'Unable to delete device.', (id) =>
      this.deleteStored(scope, id),
    );
  }

  async create(
    context: RequestContext,
    input: CreateFleetDeviceInput,
    includeState = false,
  ): Promise<DeviceResult> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const type = deviceType(input);
    const edataModule = edataModuleInput(type, input.erm) ?? null;
    const data = createDeviceData(input, this.clock);
    checkOptions(data.model, data.options);
    if (data.vehicleId !== null) {
      await this.requireVehicle(scope, data.vehicleId);
    }
    await this.requireUniqueImei(data.imei, null);
    if (data.serialNumber !== null) {
      await this.requireUniqueSerialNumber(scope, data.serialNumber, null);
    }
    await this.core.requireBranch(scope.branchId, context);
    let row: DeviceRow;
    try {
      row = await this.devices.create(scope, data, type, edataModule);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row, includeState ? context : undefined);
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetDeviceInput,
    includeState = false,
  ): Promise<DeviceResult> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const recordId = uuid(id, 'id');
    const data = updateDeviceData(input, this.clock);
    const stored = await this.devices.find(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Device not found');
    }
    const edataModule = edataModuleInput(stored.type, input.erm);
    if (!Object.keys(data).length && edataModule === undefined) {
      throw new BadRequestException('Provide at least one device field to update');
    }
    checkOptions(
      data.model === undefined ? stored.model : data.model,
      data.options ?? stored.options,
    );
    if (data.vehicleId != null) {
      await this.requireVehicle(scope, data.vehicleId);
    }
    if (data.imei !== undefined) {
      await this.requireUniqueImei(data.imei, recordId);
    }
    if (data.serialNumber != null) {
      await this.requireUniqueSerialNumber(scope, data.serialNumber, recordId);
    }
    let row: DeviceRow;
    try {
      row = await this.devices.update(scope, recordId, data, edataModule);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row, includeState ? context : undefined);
  }

  /** Telemetry keeps an IMEI snapshot when a Device is deleted. */
  async delete(context: RequestContext, id: string): Promise<DeviceResult> {
    const scope = requireScope(context);
    await requireRole(context, 'OPERATOR');
    const row = await this.deleteStored(scope, uuid(id, 'id'));
    return this.completeOne(scope, row);
  }

  private async deleteStored(scope: FleetScope, recordId: string): Promise<DeviceRow> {
    let row: DeviceRow;
    try {
      row = await this.devices.delete(scope, recordId);
    } catch (error) {
      this.writeError(error);
    }
    return row;
  }

  /** Current-pair reports are batched; status shares the Branch clock and never reports stock. */
  private async complete(scope: FleetScope, rows: readonly DeviceRow[]): Promise<DeviceResult[]> {
    if (!rows.length) {
      return [];
    }
    const pairs = rows.flatMap((row) =>
      row.vehicleId === null ? [] : [{ vehicleId: row.vehicleId, imei: row.imei }],
    );
    const freshAfter = this.routingFreshAfter(rows);
    const [reported, asOf, settings, diagnostics] = await Promise.all([
      this.telemetry.lastReported(scope, pairs),
      this.telemetry.asOf(scope),
      this.settings.read(scope),
      this.diagnostics(scope, rows),
    ]);
    return rows.map((row) => {
      const lastReportedAt =
        row.vehicleId === null
          ? null
          : (reported.get(reportingPair(row.vehicleId, row.imei)) ?? null);
      return {
        ...toDevice(row),
        erm: this.ermDevice(row, freshAfter),
        lastReportedAt,
        status: deviceStatus(row.vehicleId, lastReportedAt, asOf, settings.notReportingHours),
        diagnostics: diagnostics.get(row.id)?.diagnostics ?? { count: 0, latest: null },
        warningLamps: diagnostics.get(row.id)?.warningLamps ?? [],
        currentWarnings: diagnostics.get(row.id)?.currentWarnings ?? [],
      };
    });
  }

  private async completeOne(
    scope: FleetScope,
    row: DeviceRow,
    stateContext?: RequestContext,
  ): Promise<DeviceResult> {
    const [device] = await this.complete(scope, [row]);
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (stateContext) {
      await this.loadStates(stateContext, [device]);
    }
    return device;
  }

  private async requireVehicle(scope: FleetScope, vehicleId: string): Promise<void> {
    if (!(await this.devices.findVehicle(scope, vehicleId))) {
      invalid('vehicleId', 'Choose a vehicle in this branch.', 'VEHICLE_UNAVAILABLE');
    }
  }

  private async requireUniqueImei(value: string, excludeId: string | null): Promise<void> {
    if (await this.devices.imeiTaken(value, excludeId)) {
      invalid(DUPLICATE_IMEI.path, DUPLICATE_IMEI.message, DUPLICATE_IMEI.code);
    }
  }

  private async requireUniqueSerialNumber(
    scope: FleetScope,
    value: string,
    excludeId: string | null,
  ): Promise<void> {
    if (await this.devices.serialNumberTaken(scope, value, excludeId)) {
      invalid(
        DUPLICATE_SERIAL_NUMBER.path,
        DUPLICATE_SERIAL_NUMBER.message,
        DUPLICATE_SERIAL_NUMBER.code,
      );
    }
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      invalid('vehicleId', 'Choose a vehicle in this branch.', 'VEHICLE_UNAVAILABLE');
    }
    persistenceError(error, 'Device');
  }
}
