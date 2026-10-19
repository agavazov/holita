import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import type {
  CreateFleetDeviceInput,
  FleetDevice,
  FleetDevicePage,
  FleetDeviceSortField,
  QueryFleetDevicesArgs,
  UpdateFleetDeviceInput,
} from '../../generated/graphql/types.js';
import { FleetDeviceModel, FleetDeviceOption } from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumFilter,
  enumList,
  type FieldError,
  type FleetScope,
  idList,
  ids,
  invalid,
  optionalDateTime,
  optionalEnum,
  optionalPattern,
  optionalText,
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
  type DeviceData,
  type DeviceListCriteria,
  type DeviceRow,
  DevicesRepository,
} from './devices.repository.js';

export type DeviceResult = Omit<FleetDevice, 'branch'>;
type StoredDevice = Omit<DeviceResult, 'lastReportedAt'>;

const DEVICE_MODELS = Object.values(FleetDeviceModel);
const DEVICE_OPTIONS = Object.values(FleetDeviceOption);
const SORT_FIELDS: readonly FleetDeviceSortField[] = ['IMEI', 'INSTALLED_AT', 'CREATED_AT'];

/** Options each model supports; OTHER accepts every option and no model accepts none. */
const MODEL_OPTIONS: Record<FleetDeviceModel, readonly FleetDeviceOption[]> = {
  STARLINK_TRACKER: [
    'CELLULAR_4G',
    'SAFETY_SF',
    'IRF',
    'CAN',
    'DRIVER_ID',
    'ECONNECT',
    'RS232',
    'EXTERNAL_ANTENNA',
    'VOICE',
    'WIFI',
    'WILIOT',
  ],
  STARLINK_SCOUT: ['CELLULAR_4G', 'SAFETY_SF', 'TEMPERATURE_DS', 'GEOZONES_GO', 'IRF'],
  OTHER: DEVICE_OPTIONS,
};

const DUPLICATE_IMEI: FieldError = {
  path: 'imei',
  message: 'IMEI is already used in this branch.',
};
const UNIQUE_INDEXES = new Map([['Device_tenantId_branchId_imei_key', DUPLICATE_IMEI]]);

function imei(value: unknown): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9]{15}$/.test(result)) {
    invalid('imei', 'Enter an IMEI of exactly 15 digits.');
  }
  return result;
}

function options(value: unknown): DeviceData['options'] {
  return value === null || value === undefined
    ? []
    : enumList(value, DEVICE_OPTIONS, 'options', DEVICE_OPTIONS.length);
}

function checkOptions(model: FleetDeviceModel | null, selected: readonly FleetDeviceOption[]) {
  const supported = model === null ? [] : MODEL_OPTIONS[model];
  if (selected.some((option) => !supported.includes(option))) {
    invalid(
      'options',
      model === null
        ? 'Choose a device model before selecting options.'
        : 'Choose only options that the selected model supports.',
    );
  }
}

function toDevice(row: DeviceRow): StoredDevice {
  return {
    id: row.id,
    branchId: row.branchId,
    imei: row.imei,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    model: row.model,
    options: row.options,
    firmwareVersion: row.firmwareVersion,
    simPhoneNumber: row.simPhoneNumber,
    simIccid: row.simIccid,
    installedAt: row.installedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
    private readonly telemetry: TelemetryService,
  ) {}

  async list(
    context: RequestContext,
    args: QueryFleetDevicesArgs,
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
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'CREATED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const page = await this.devices.list(scope, { offset, limit }, criteria, sort);
    return { items: await this.complete(scope, page.items), total: page.total, offset, limit };
  }

  async find(context: RequestContext, id: string): Promise<DeviceResult> {
    const scope = requireScope(context);
    const row = await this.devices.find(scope, uuid(id, 'id'));
    if (!row) {
      throw new NotFoundException('Device not found');
    }
    return this.completeOne(scope, row);
  }

  async create(context: RequestContext, input: CreateFleetDeviceInput): Promise<DeviceResult> {
    const scope = requireScope(context);
    const data: DeviceData = {
      imei: imei(input.imei),
      vehicleId: uuid(input.vehicleId, 'vehicleId'),
      model: optionalEnum(input.model, DEVICE_MODELS, 'model'),
      options: options(input.options),
      firmwareVersion: this.firmwareVersion(input.firmwareVersion),
      simPhoneNumber: this.simPhoneNumber(input.simPhoneNumber),
      simIccid: this.simIccid(input.simIccid),
      installedAt: this.installedAt(input.installedAt),
      notes: optionalText(input.notes, 'notes', 2000),
    };
    checkOptions(data.model, data.options);
    await this.requireVehicle(scope, data.vehicleId);
    await this.requireUniqueImei(scope, data.imei, null);
    await this.core.requireBranch(scope.branchId, context);
    let row: DeviceRow;
    try {
      row = await this.devices.create(scope, data);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row);
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetDeviceInput,
  ): Promise<DeviceResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const data: Partial<DeviceData> = {};
    if (input.imei !== undefined) {
      data.imei = imei(input.imei);
    }
    if (input.vehicleId !== undefined) {
      data.vehicleId = uuid(input.vehicleId, 'vehicleId');
    }
    if (input.model !== undefined) {
      data.model = optionalEnum(input.model, DEVICE_MODELS, 'model');
    }
    if (input.options !== undefined) {
      data.options = options(input.options);
    }
    if (input.firmwareVersion !== undefined) {
      data.firmwareVersion = this.firmwareVersion(input.firmwareVersion);
    }
    if (input.simPhoneNumber !== undefined) {
      data.simPhoneNumber = this.simPhoneNumber(input.simPhoneNumber);
    }
    if (input.simIccid !== undefined) {
      data.simIccid = this.simIccid(input.simIccid);
    }
    if (input.installedAt !== undefined) {
      data.installedAt = this.installedAt(input.installedAt);
    }
    if (input.notes !== undefined) {
      data.notes = optionalText(input.notes, 'notes', 2000);
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('Provide at least one device field to update');
    }
    const stored = await this.devices.find(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Device not found');
    }
    checkOptions(
      data.model === undefined ? stored.model : data.model,
      data.options ?? stored.options,
    );
    if (data.vehicleId !== undefined) {
      await this.requireVehicle(scope, data.vehicleId);
    }
    if (data.imei !== undefined) {
      await this.requireUniqueImei(scope, data.imei, recordId);
    }
    let row: DeviceRow;
    try {
      row = await this.devices.update(scope, recordId, data);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row);
  }

  /** Devices with telemetry history can be deleted: samples keep the IMEI as a snapshot. */
  async delete(context: RequestContext, id: string): Promise<DeviceResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    let row: DeviceRow;
    try {
      row = await this.devices.delete(scope, recordId);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row);
  }

  /** Attaches `lastReportedAt` of each device's current (vehicle, IMEI) pair in one query. */
  private async complete(scope: FleetScope, rows: readonly DeviceRow[]): Promise<DeviceResult[]> {
    if (!rows.length) {
      return [];
    }
    const reported = await this.telemetry.lastReported(
      scope,
      rows.map((row) => ({ vehicleId: row.vehicleId, imei: row.imei })),
    );
    return rows.map((row) => ({
      ...toDevice(row),
      lastReportedAt: reported.get(reportingPair(row.vehicleId, row.imei)) ?? null,
    }));
  }

  private async completeOne(scope: FleetScope, row: DeviceRow): Promise<DeviceResult> {
    const [device] = await this.complete(scope, [row]);
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  private firmwareVersion(value: unknown): string | null {
    return optionalPattern(
      value,
      'firmwareVersion',
      32,
      /^[0-9A-Za-z._-]{1,32}$/,
      'Use letters, digits, dots, underscores and hyphens.',
    );
  }

  private simPhoneNumber(value: unknown): string | null {
    return optionalPattern(
      value,
      'simPhoneNumber',
      20,
      /^\+?[0-9]{6,19}$/,
      'Enter 6 to 19 digits with an optional leading +.',
    );
  }

  private simIccid(value: unknown): string | null {
    return optionalPattern(value, 'simIccid', 22, /^[0-9]{18,22}$/, 'Enter 18 to 22 digits.');
  }

  /** Installation time from 2000-01-01 up to now. */
  private installedAt(value: unknown): Date | null {
    const result = optionalDateTime(value, 'installedAt');
    if (result !== null && result.getTime() > this.clock.now().getTime()) {
      invalid('installedAt', 'Installation time cannot be in the future.');
    }
    return result;
  }

  private async requireVehicle(scope: FleetScope, vehicleId: string): Promise<void> {
    if (!(await this.devices.findVehicle(scope, vehicleId))) {
      invalid('vehicleId', 'Choose a vehicle in this branch.');
    }
  }

  private async requireUniqueImei(
    scope: FleetScope,
    value: string,
    excludeId: string | null,
  ): Promise<void> {
    if (await this.devices.imeiTaken(scope, value, excludeId)) {
      invalid(DUPLICATE_IMEI.path, DUPLICATE_IMEI.message);
    }
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      invalid('vehicleId', 'Choose a vehicle in this branch.');
    }
    persistenceError(error, 'Device');
  }
}
