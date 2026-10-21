import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CoreClient } from '../../integrations/core/core.client.js';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclePage,
  FleetVehicleSortField,
  FleetVehicleActionFailure,
  FleetVehicleActionResult,
  FleetVehicleSummary,
  QueryFleetVehiclesArgs,
  UpdateFleetVehicleInput,
} from '../../generated/graphql/types.js';
import {
  FleetFuelType,
  FleetVehicleStatus,
  FleetVehicleType,
} from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  booleanFilter,
  enumFilter,
  enumValue,
  type FieldError,
  type FleetScope,
  idList,
  ids,
  invalid,
  invalidFields,
  optionalEnum,
  optionalInteger,
  optionalText,
  optionalUuid,
  pagination,
  persistenceError,
  requireScope,
  rethrowUniqueViolation,
  searchTokens,
  sortDirection,
  sortField,
  text,
  uuid,
} from '../../validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EventsService } from '../events/events.service.js';
import { ServiceTasksService } from '../service-tasks/service-tasks.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import {
  type VehicleData,
  type VehicleListCriteria,
  type VehicleListRow,
  type VehicleRow,
  VehiclesRepository,
} from './vehicles.repository.js';
import { vehicleConditions } from './vehicle-filter.js';

export type VehicleResult = Omit<FleetVehicle, 'branch'>;
type StoredVehicle = Omit<VehicleResult, 'state' | 'openAlertCount' | 'nextService'>;

const VEHICLE_TYPES = Object.values(FleetVehicleType);
const FUEL_TYPES = Object.values(FleetFuelType);
const VEHICLE_STATUSES = Object.values(FleetVehicleStatus);
const SORT_FIELDS: readonly FleetVehicleSortField[] = [
  'LICENSE_PLATE',
  'FLEET_NUMBER',
  'CREATED_AT',
  'UPDATED_AT',
  'STATUS',
  'LAST_REPORTED_AT',
  'ODOMETER_KM',
];

const DUPLICATE_FLEET_NUMBER: FieldError = {
  path: 'fleetNumber',
  message: 'Fleet number is already used in this branch.',
};
const DUPLICATE_VIN: FieldError = { path: 'vin', message: 'VIN is already used in this branch.' };
const UNAVAILABLE_DRIVER: FieldError = {
  path: 'currentDriverId',
  message: 'Choose an active driver in this branch.',
};
const UNIQUE_INDEXES = new Map([
  ['Vehicle_tenantId_branchId_fleetNumber_key', DUPLICATE_FLEET_NUMBER],
  ['Vehicle_tenantId_branchId_vin_key', DUPLICATE_VIN],
]);
const DELETE_CONFLICT = 'Vehicle has devices or history; deactivate it instead.';

/** VIN: trimmed, upper-cased, 17 characters without I, O and Q. */
function vin(value: unknown): string | null {
  const result = optionalText(value, 'vin', 17)?.toUpperCase() ?? null;
  if (result !== null && !/^[A-HJ-NPR-Z0-9]{17}$/.test(result)) {
    invalid('vin', 'Enter a VIN of 17 letters and digits without I, O or Q.');
  }
  return result;
}

/** Validates the fields present in the input; `undefined` leaves a field unchanged. */
function vehicleChanges(input: UpdateFleetVehicleInput): Partial<VehicleData> {
  const data: Partial<VehicleData> = {};
  if (input.licensePlate !== undefined) {
    data.licensePlate = text(input.licensePlate, 'licensePlate', 32);
  }
  if (input.notes !== undefined) {
    data.notes = optionalText(input.notes, 'notes', 2000);
  }
  if (input.fleetNumber !== undefined) {
    data.fleetNumber = optionalText(input.fleetNumber, 'fleetNumber', 16);
  }
  if (input.vehicleType !== undefined) {
    data.vehicleType = optionalEnum(input.vehicleType, VEHICLE_TYPES, 'vehicleType');
  }
  if (input.make !== undefined) {
    data.make = optionalText(input.make, 'make', 64);
  }
  if (input.model !== undefined) {
    data.model = optionalText(input.model, 'model', 64);
  }
  if (input.modelYear !== undefined) {
    data.modelYear = optionalInteger(input.modelYear, 'modelYear', 1950, 2100);
  }
  if (input.vin !== undefined) {
    data.vin = vin(input.vin);
  }
  if (input.fuelType !== undefined) {
    data.fuelType = optionalEnum(input.fuelType, FUEL_TYPES, 'fuelType');
  }
  if (input.fuelTankCapacityL !== undefined) {
    data.fuelTankCapacityL = optionalInteger(input.fuelTankCapacityL, 'fuelTankCapacityL', 1, 2000);
  }
  if (input.status !== undefined) {
    data.status = enumValue(input.status, VEHICLE_STATUSES, 'status');
  }
  if (input.groupId !== undefined) {
    data.groupId = optionalUuid(input.groupId, 'groupId');
  }
  if (input.currentDriverId !== undefined) {
    data.currentDriverId = optionalUuid(input.currentDriverId, 'currentDriverId');
  }
  return data;
}

function toVehicle(row: VehicleRow): StoredVehicle {
  return {
    id: row.id,
    branchId: row.branchId,
    licensePlate: row.licensePlate,
    notes: row.notes,
    fleetNumber: row.fleetNumber,
    vehicleType: row.vehicleType,
    make: row.make,
    model: row.model,
    modelYear: row.modelYear,
    vin: row.vin,
    fuelType: row.fuelType,
    fuelTankCapacityL: row.fuelTankCapacityL,
    status: row.status,
    groupId: row.groupId,
    group: row.group,
    currentDriverId: row.currentDriverId,
    currentDriver: row.currentDriver,
    deviceCount: row._count.devices,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);
  constructor(
    private readonly vehicles: VehiclesRepository,
    private readonly core: CoreClient,
    private readonly telemetry: TelemetryService,
    private readonly events: EventsService,
    private readonly serviceTasks: ServiceTasksService,
  ) {}

  async list(
    context: RequestContext,
    args: QueryFleetVehiclesArgs,
  ): Promise<Omit<FleetVehiclePage, 'items'> & { items: VehicleResult[] }> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const criteria: VehicleListCriteria = {
      tokens,
      ids: selected,
      statuses: enumFilter(filter?.statuses, VEHICLE_STATUSES, 'statuses'),
      vehicleTypes: enumFilter(filter?.vehicleTypes, VEHICLE_TYPES, 'vehicleTypes'),
      fuelTypes: enumFilter(filter?.fuelTypes, FUEL_TYPES, 'fuelTypes'),
      groupIds: idList(filter?.groupIds, 'groupIds'),
      hasGroup: booleanFilter(filter?.hasGroup, 'hasGroup'),
      currentDriverIds: idList(filter?.currentDriverIds, 'currentDriverIds'),
      hasDriver: booleanFilter(filter?.hasDriver, 'hasDriver'),
      hasDevice: booleanFilter(filter?.hasDevice, 'hasDevice'),
      hasOpenAlerts: booleanFilter(filter?.hasOpenAlerts, 'hasOpenAlerts'),
      ...(filter?.allOf == null ? {} : { allOf: vehicleConditions(filter.allOf) }),
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'CREATED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const page = await this.vehicles.list(scope, { offset, limit }, criteria, sort);
    return { items: await this.completeList(scope, page.items), total: page.total, offset, limit };
  }

  summary(context: RequestContext): Promise<FleetVehicleSummary> {
    return this.vehicles.summary(requireScope(context));
  }

  async deleteMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetVehicleActionResult> {
    requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one vehicle.');
    }
    const succeededIds: string[] = [];
    const failures: FleetVehicleActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.delete(context, id);
        succeededIds.push(id);
      } catch (error: unknown) {
        failures.push(this.actionFailure(context, id, error));
      }
    }
    return { succeededIds, failures };
  }

  async deactivateMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetVehicleActionResult> {
    requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one vehicle.');
    }
    const succeededIds: string[] = [];
    const failures: FleetVehicleActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.deactivate(context, id);
        succeededIds.push(id);
      } catch (error: unknown) {
        failures.push(this.actionFailure(context, id, error));
      }
    }
    return { succeededIds, failures };
  }

  private actionFailure(
    context: RequestContext,
    id: string,
    error: unknown,
  ): FleetVehicleActionFailure {
    if (error instanceof HttpException) {
      const code = new Map([
        [400, 'BAD_USER_INPUT'],
        [404, 'NOT_FOUND'],
        [409, 'CONFLICT'],
        [503, 'SERVICE_UNAVAILABLE'],
      ]).get(error.getStatus());
      if (code) {
        return { id, code, message: error.message };
      }
    }
    this.logger.error({
      requestId: context.requestId,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { id, code: 'INTERNAL_SERVER_ERROR', message: 'Unable to change vehicle.' };
  }

  async find(context: RequestContext, id: string): Promise<VehicleResult> {
    const scope = requireScope(context);
    const row = await this.vehicles.find(scope, uuid(id, 'id'));
    if (!row) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.completeOne(scope, row);
  }

  async create(context: RequestContext, input: CreateFleetVehicleInput): Promise<VehicleResult> {
    const scope = requireScope(context);
    const data: VehicleData = {
      licensePlate: text(input.licensePlate, 'licensePlate', 32),
      notes: optionalText(input.notes, 'notes', 2000),
      fleetNumber: optionalText(input.fleetNumber, 'fleetNumber', 16),
      vehicleType: optionalEnum(input.vehicleType, VEHICLE_TYPES, 'vehicleType'),
      make: optionalText(input.make, 'make', 64),
      model: optionalText(input.model, 'model', 64),
      modelYear: optionalInteger(input.modelYear, 'modelYear', 1950, 2100),
      vin: vin(input.vin),
      fuelType: optionalEnum(input.fuelType, FUEL_TYPES, 'fuelType'),
      fuelTankCapacityL: optionalInteger(input.fuelTankCapacityL, 'fuelTankCapacityL', 1, 2000),
      status: optionalEnum(input.status, VEHICLE_STATUSES, 'status') ?? 'ACTIVE',
      groupId: optionalUuid(input.groupId, 'groupId'),
      currentDriverId: optionalUuid(input.currentDriverId, 'currentDriverId'),
    };
    await this.checkRelations(scope, data, data);
    await this.checkDuplicates(scope, data, null);
    await this.core.requireBranch(scope.branchId, context);
    let row: VehicleRow | null;
    try {
      row = await this.vehicles.create(scope, data);
    } catch (error) {
      this.writeError(error);
    }
    if (row === null) {
      invalidFields([UNAVAILABLE_DRIVER]);
    }
    return this.completeOne(scope, row);
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetVehicleInput,
  ): Promise<VehicleResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const data = vehicleChanges(input);
    if (!Object.keys(data).length) {
      throw new BadRequestException('Provide at least one vehicle field to update');
    }
    const stored = await this.vehicles.find(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Vehicle not found');
    }
    await this.checkRelations(
      scope,
      {
        status: data.status ?? stored.status,
        currentDriverId:
          data.currentDriverId === undefined ? stored.currentDriverId : data.currentDriverId,
      },
      data,
    );
    await this.checkDuplicates(scope, data, recordId);
    let row: VehicleRow | null;
    try {
      const result = await this.vehicles.update(scope, recordId, data);
      if (result && 'inactiveAssignment' in result) {
        invalid('currentDriverId', 'Unassign the driver before deactivating the vehicle.');
      }
      row = result;
    } catch (error) {
      this.writeError(error);
    }
    if (row === null) {
      invalidFields([UNAVAILABLE_DRIVER]);
    }
    return this.completeOne(scope, row);
  }

  async deactivate(context: RequestContext, id: string): Promise<VehicleResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    let row: VehicleRow;
    try {
      row = await this.vehicles.deactivate(scope, recordId);
    } catch (error) {
      persistenceError(error, 'Vehicle');
    }
    return this.completeOne(scope, row);
  }

  /** A deletable vehicle has no devices, samples, events or tasks, so its derived values are empty. */
  async delete(context: RequestContext, id: string): Promise<VehicleResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    let row: VehicleRow;
    try {
      row = await this.vehicles.delete(scope, recordId);
    } catch (error) {
      persistenceError(error, 'Vehicle', DELETE_CONFLICT);
    }
    return this.completeOne(scope, row);
  }

  /** Keep filtered/sorted facts from the list snapshot; next service is not a list predicate. */
  private async completeList(
    scope: FleetScope,
    rows: readonly VehicleListRow[],
  ): Promise<VehicleResult[]> {
    if (!rows.length) {
      return [];
    }
    const nextServices = await this.serviceTasks.nextForVehicles(
      scope,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...toVehicle(row),
      state: row.state,
      openAlertCount: row.openAlertCount,
      nextService: nextServices.get(row.id) ?? null,
    }));
  }

  /** Reads and writes attach current derived values through three scoped batches. */
  private async complete(scope: FleetScope, rows: readonly VehicleRow[]): Promise<VehicleResult[]> {
    if (!rows.length) {
      return [];
    }
    const vehicleIds = rows.map((row) => row.id);
    const [states, openAlerts, nextServices] = await Promise.all([
      this.telemetry.vehicleStates(scope, vehicleIds),
      this.events.openAlertCounts(scope, vehicleIds),
      this.serviceTasks.nextForVehicles(scope, vehicleIds),
    ]);
    return rows.map((row) => {
      const state = states.get(row.id);
      if (!state) {
        throw new Error('Missing vehicle state');
      }
      return {
        ...toVehicle(row),
        state,
        openAlertCount: openAlerts.get(row.id) ?? 0,
        nextService: nextServices.get(row.id) ?? null,
      };
    });
  }

  private async completeOne(scope: FleetScope, row: VehicleRow): Promise<VehicleResult> {
    const [vehicle] = await this.complete(scope, [row]);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  /**
   * The resulting row (stored + input) must not be INACTIVE with a driver; a group or driver
   * named by the input must belong to the Branch and the driver must not be INACTIVE.
   */
  private async checkRelations(
    scope: FleetScope,
    result: Pick<VehicleData, 'status' | 'currentDriverId'>,
    changes: Partial<VehicleData>,
  ): Promise<void> {
    if (result.status === 'INACTIVE' && result.currentDriverId !== null) {
      invalid('currentDriverId', 'Unassign the driver before deactivating the vehicle.');
    }
    if (
      changes.groupId !== undefined &&
      changes.groupId !== null &&
      !(await this.vehicles.findGroup(scope, changes.groupId))
    ) {
      invalid('groupId', 'Choose a vehicle group in this branch.');
    }
    if (changes.currentDriverId !== undefined && changes.currentDriverId !== null) {
      const driver = await this.vehicles.findDriver(scope, changes.currentDriverId);
      if (!driver || driver.status === 'INACTIVE') {
        invalidFields([UNAVAILABLE_DRIVER]);
      }
    }
  }

  private async checkDuplicates(
    scope: FleetScope,
    changes: Partial<VehicleData>,
    excludeId: string | null,
  ): Promise<void> {
    const values = { fleetNumber: changes.fleetNumber ?? null, vin: changes.vin ?? null };
    if (values.fleetNumber === null && values.vin === null) {
      return;
    }
    const taken = await this.vehicles.duplicates(scope, values, excludeId);
    const errors = [
      ...(taken.fleetNumber ? [DUPLICATE_FLEET_NUMBER] : []),
      ...(taken.vin ? [DUPLICATE_VIN] : []),
    ];
    if (errors.length) {
      invalidFields(errors);
    }
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new BadRequestException('The selected group or driver is no longer in this branch.');
    }
    persistenceError(error, 'Vehicle');
  }
}
