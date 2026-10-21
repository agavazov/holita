import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { addDays, businessDate, dataWindow, FleetClock } from '../../clock/fleet-clock.js';
import {
  DOCUMENT_EXPIRING_DAYS,
  DRIVER_STATS_DAYS,
  LOW_CONFIDENCE_TRIPS,
} from '../../fleet-thresholds.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import type {
  CreateFleetDriverInput,
  FleetDocumentStatus,
  FleetDriver,
  FleetDriverActionFailure,
  FleetDriverActionResult,
  FleetDriverPage,
  FleetDriverScorecard,
  FleetDriverSortField,
  FleetDriverSummary,
  QueryFleetDriverScorecardArgs,
  QueryFleetDriversArgs,
  UpdateFleetDriverInput,
} from '../../generated/graphql/types.js';
import { EventsService } from '../events/events.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { TripsService } from '../trips/trips.service.js';
import { FleetDriverStatus, FleetLicenseCategory } from '../../generated/prisma/enums.js';
import { dateOnlyToDate, dateToDateOnly } from '../../graphql/scalars.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  booleanFilter,
  enumFilter,
  enumList,
  enumValue,
  type FieldError,
  type FleetScope,
  ids,
  integer,
  integerFilter,
  invalid,
  invalidFields,
  optionalDateOnly,
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
  text,
  uuid,
} from '../../validation.js';
import {
  type DriverData,
  type DriverListCriteria,
  type DriverRow,
  type DriverStats,
  DriversRepository,
} from './drivers.repository.js';
import { driverConditions } from './driver-filter.js';
import { SettingsService } from '../settings/settings.service.js';

export type DriverResult = FleetDriver;
type StoredDriver = Omit<
  DriverResult,
  'distance30dKm' | 'tripCount30d' | 'drivingScore30d' | 'maneuversPer100Km30d'
>;

/** Longest scorecard period; matches the `fleetManeuverCounts` period limit. */
const MAX_SCORECARD_DAYS = 93;

const DRIVER_STATUSES = Object.values(FleetDriverStatus);
const LICENSE_CATEGORIES = Object.values(FleetLicenseCategory);
const SORT_FIELDS: readonly FleetDriverSortField[] = [
  'NAME',
  'LAST_NAME',
  'EMPLOYEE_NUMBER',
  'LICENSE_EXPIRES_ON',
  'TACHOGRAPH_CARD_EXPIRES_ON',
  'CREATED_AT',
  'STATUS',
  'DRIVING_SCORE_30D',
  'TRIP_COUNT_30D',
  'DISTANCE_30D_KM',
];

const DUPLICATE_EMPLOYEE_NUMBER: FieldError = {
  path: 'employeeNumber',
  message: 'Employee number is already used in this branch.',
  code: 'ALREADY_EXISTS',
};
const DUPLICATE_IDENTIFICATION_KEY: FieldError = {
  path: 'identificationKey',
  message: 'Identification key is already used in this branch.',
  code: 'ALREADY_EXISTS',
};
const ASSIGNED_DRIVER: FieldError = {
  path: 'status',
  message: 'Unassign the driver from its vehicles first.',
  code: 'DRIVER_ASSIGNED',
};
const UNIQUE_INDEXES = new Map([
  ['Driver_tenantId_branchId_employeeNumber_key', DUPLICATE_EMPLOYEE_NUMBER],
  ['Driver_tenantId_branchId_identificationKey_key', DUPLICATE_IDENTIFICATION_KEY],
]);
const DELETE_CONFLICT = 'Driver is assigned or has trip history; set the driver inactive instead.';

/** Status of one document at the business date; `null` when no expiry date is recorded. */
export function documentStatus(
  expiresOn: string | null,
  today: string,
): Exclude<FleetDocumentStatus, 'NOT_RECORDED'> | null {
  if (expiresOn === null) {
    return null;
  }
  if (expiresOn < today) {
    return 'EXPIRED';
  }
  return expiresOn <= addDays(today, DOCUMENT_EXPIRING_DAYS) ? 'EXPIRING' : 'VALID';
}

/** Worst status of the licence and tachograph card (EXPIRED > EXPIRING > VALID). */
export function driverDocumentStatus(
  documents: { licenseExpiresOn: string | null; tachographCardExpiresOn: string | null },
  today: string,
): FleetDocumentStatus {
  const statuses = [
    documentStatus(documents.licenseExpiresOn, today),
    documentStatus(documents.tachographCardExpiresOn, today),
  ];
  if (statuses.includes('EXPIRED')) {
    return 'EXPIRED';
  }
  if (statuses.includes('EXPIRING')) {
    return 'EXPIRING';
  }
  return statuses.includes('VALID') ? 'VALID' : 'NOT_RECORDED';
}

function toDriver(row: DriverRow, today: string): StoredDriver {
  const licenseExpiresOn =
    row.licenseExpiresOn === null ? null : dateToDateOnly(row.licenseExpiresOn);
  const tachographCardExpiresOn =
    row.tachographCardExpiresOn === null ? null : dateToDateOnly(row.tachographCardExpiresOn);
  return {
    id: row.id,
    branchId: row.branchId,
    firstName: row.firstName,
    lastName: row.lastName,
    employeeNumber: row.employeeNumber,
    identificationKey: row.identificationKey,
    phone: row.phone,
    email: row.email,
    licenseNumber: row.licenseNumber,
    licenseCategories: row.licenseCategories,
    licenseExpiresOn,
    tachographCardNumber: row.tachographCardNumber,
    tachographCardExpiresOn,
    status: row.status,
    notes: row.notes,
    vehicles: row.vehicles,
    documentStatus: driverDocumentStatus({ licenseExpiresOn, tachographCardExpiresOn }, today),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function expiryDate(value: unknown, path: string): Date | null {
  const result = optionalDateOnly(value, path);
  return result === null ? null : dateOnlyToDate(result);
}

function licenseCategories(value: unknown): DriverData['licenseCategories'] {
  return value === null || value === undefined
    ? []
    : enumList(value, LICENSE_CATEGORIES, 'licenseCategories', LICENSE_CATEGORIES.length);
}

const fieldRules = {
  employeeNumber: (value: unknown) => optionalText(value, 'employeeNumber', 32),
  identificationKey: (value: unknown) => optionalText(value, 'identificationKey', 32),
  phone: (value: unknown) =>
    optionalPattern(
      value,
      'phone',
      20,
      /^\+?[0-9 ]{6,20}$/,
      'Enter 6 to 20 digits or spaces with an optional leading +.',
    ),
  email: (value: unknown) =>
    optionalPattern(value, 'email', 254, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email.'),
  licenseNumber: (value: unknown) => optionalText(value, 'licenseNumber', 32),
  tachographCardNumber: (value: unknown) => optionalText(value, 'tachographCardNumber', 16),
  notes: (value: unknown) => optionalText(value, 'notes', 2000),
};

/** Maneuvers per 100 km; null without distance. */
function per100Km(count: number, distanceKm: number): number | null {
  return distanceKm > 0 ? (count / distanceKm) * 100 : null;
}

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);
  constructor(
    private readonly drivers: DriversRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
    private readonly telemetry: TelemetryService,
    private readonly trips: TripsService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
  ) {}

  async list(context: RequestContext, args: QueryFleetDriversArgs): Promise<FleetDriverPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const today = await this.today(scope);
    const withinDays = integerFilter(
      filter?.documentsExpireWithinDays,
      'documentsExpireWithinDays',
      0,
      365,
    );
    const criteria: DriverListCriteria = {
      tokens,
      ids: selected,
      statuses: enumFilter(filter?.statuses, DRIVER_STATUSES, 'statuses'),
      licenseCategories: enumFilter(
        filter?.licenseCategories,
        LICENSE_CATEGORIES,
        'licenseCategories',
      ),
      documentsExpireBy:
        withinDays === undefined ? undefined : dateOnlyToDate(addDays(today, withinDays)),
      hasVehicle: booleanFilter(filter?.hasVehicle, 'hasVehicle'),
      ...(filter?.allOf == null ? {} : { allOf: driverConditions(filter.allOf) }),
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'LAST_NAME'),
      direction: sortDirection(args.sort?.direction, 'ASC'),
    };
    const page = await this.drivers.list(scope, { offset, limit }, criteria, sort);
    return {
      items: await this.withStats(
        scope,
        page.items,
        today,
        page.items[0]?.dataAsOf ?? null,
        new Map(page.items.map((row) => [row.id, row])),
      ),
      total: page.total,
      offset,
      limit,
    };
  }

  async find(context: RequestContext, id: string): Promise<DriverResult> {
    const scope = requireScope(context);
    const row = await this.drivers.find(scope, uuid(id, 'id'));
    if (!row) {
      throw new NotFoundException('Driver not found');
    }
    return this.completeOne(scope, row);
  }

  async summary(context: RequestContext): Promise<FleetDriverSummary> {
    const scope = requireScope(context);
    const dueBy = addDays(await this.today(scope), DOCUMENT_EXPIRING_DAYS);
    return this.drivers.summary(scope, dateOnlyToDate(dueBy));
  }

  async deleteMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetDriverActionResult> {
    const scope = requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one driver.', 'REQUIRED');
    }
    const succeededIds: string[] = [];
    const failures: FleetDriverActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.deleteStored(scope, id);
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
  ): Promise<FleetDriverActionResult> {
    const scope = requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one driver.', 'REQUIRED');
    }
    const succeededIds: string[] = [];
    const failures: FleetDriverActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.updateStored(scope, id, { status: 'INACTIVE' });
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
  ): FleetDriverActionFailure {
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
    return { id, code: 'INTERNAL_SERVER_ERROR', message: 'Unable to change driver.' };
  }

  /** Statistics of the `days` before the data clock; empty windows when there is no data. */
  async scorecard(
    context: RequestContext,
    args: QueryFleetDriverScorecardArgs,
  ): Promise<FleetDriverScorecard> {
    const scope = requireScope(context);
    const driverId = uuid(args.driverId, 'driverId');
    const days = integer(args.days ?? DRIVER_STATS_DAYS, 'days', 1, MAX_SCORECARD_DAYS);
    const row = await this.drivers.find(scope, driverId);
    if (!row) {
      throw new NotFoundException('Driver not found');
    }
    const asOf = await this.telemetry.asOf(scope);
    const window = dataWindow(asOf, days);
    const [[driver], score, maneuvers] = await Promise.all([
      this.withStats(scope, [row], await this.today(scope), asOf),
      window === null ? null : this.trips.driverScore(scope, driverId, window),
      this.events.driverManeuvers(scope, driverId, window),
    ]);
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    const distanceKm = score?.distanceKm ?? 0;
    const scoredTripCount = score?.scoredTripCount ?? 0;
    const maneuverCount = maneuvers.reduce((sum, item) => sum + item.total, 0);
    return {
      driver,
      asOf,
      windowStart: window?.start ?? null,
      windowEnd: window?.end ?? null,
      distanceKm,
      tripCount: score?.tripCount ?? 0,
      scoredTripCount,
      averageDrivingScore: score?.averageDrivingScore ?? null,
      averageEcoScore: score?.averageEcoScore ?? null,
      maneuverCount,
      maneuversPer100Km: per100Km(maneuverCount, distanceKm),
      maneuvers,
      lowConfidence: scoredTripCount < LOW_CONFIDENCE_TRIPS,
    };
  }

  async create(context: RequestContext, input: CreateFleetDriverInput): Promise<DriverResult> {
    const scope = requireScope(context);
    const data: DriverData = {
      firstName: text(input.firstName, 'firstName', 64),
      lastName: text(input.lastName, 'lastName', 64),
      employeeNumber: fieldRules.employeeNumber(input.employeeNumber),
      identificationKey: fieldRules.identificationKey(input.identificationKey),
      phone: fieldRules.phone(input.phone),
      email: fieldRules.email(input.email),
      licenseNumber: fieldRules.licenseNumber(input.licenseNumber),
      licenseCategories: licenseCategories(input.licenseCategories),
      licenseExpiresOn: expiryDate(input.licenseExpiresOn, 'licenseExpiresOn'),
      tachographCardNumber: fieldRules.tachographCardNumber(input.tachographCardNumber),
      tachographCardExpiresOn: expiryDate(input.tachographCardExpiresOn, 'tachographCardExpiresOn'),
      status: optionalEnum(input.status, DRIVER_STATUSES, 'status') ?? 'ACTIVE',
      notes: fieldRules.notes(input.notes),
    };
    await this.checkDuplicates(scope, data, null);
    await this.core.requireBranch(scope.branchId, context);
    let row: DriverRow;
    try {
      row = await this.drivers.create(scope, data);
    } catch (error) {
      this.writeError(error);
    }
    return this.completeOne(scope, row);
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetDriverInput,
  ): Promise<DriverResult> {
    const scope = requireScope(context);
    const row = await this.updateStored(scope, uuid(id, 'id'), input);
    return this.completeOne(scope, row);
  }

  private async updateStored(
    scope: FleetScope,
    recordId: string,
    input: UpdateFleetDriverInput,
  ): Promise<DriverRow> {
    const data: Partial<DriverData> = {};
    if (input.firstName !== undefined) {
      data.firstName = text(input.firstName, 'firstName', 64);
    }
    if (input.lastName !== undefined) {
      data.lastName = text(input.lastName, 'lastName', 64);
    }
    if (input.employeeNumber !== undefined) {
      data.employeeNumber = fieldRules.employeeNumber(input.employeeNumber);
    }
    if (input.identificationKey !== undefined) {
      data.identificationKey = fieldRules.identificationKey(input.identificationKey);
    }
    if (input.phone !== undefined) {
      data.phone = fieldRules.phone(input.phone);
    }
    if (input.email !== undefined) {
      data.email = fieldRules.email(input.email);
    }
    if (input.licenseNumber !== undefined) {
      data.licenseNumber = fieldRules.licenseNumber(input.licenseNumber);
    }
    if (input.licenseCategories !== undefined) {
      data.licenseCategories = licenseCategories(input.licenseCategories);
    }
    if (input.licenseExpiresOn !== undefined) {
      data.licenseExpiresOn = expiryDate(input.licenseExpiresOn, 'licenseExpiresOn');
    }
    if (input.tachographCardNumber !== undefined) {
      data.tachographCardNumber = fieldRules.tachographCardNumber(input.tachographCardNumber);
    }
    if (input.tachographCardExpiresOn !== undefined) {
      data.tachographCardExpiresOn = expiryDate(
        input.tachographCardExpiresOn,
        'tachographCardExpiresOn',
      );
    }
    if (input.status !== undefined) {
      data.status = enumValue(input.status, DRIVER_STATUSES, 'status');
    }
    if (input.notes !== undefined) {
      data.notes = fieldRules.notes(input.notes);
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('Provide at least one driver field to update');
    }
    const stored = await this.drivers.find(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Driver not found');
    }
    if (data.status === 'INACTIVE' && stored.vehicles.length) {
      invalidFields([ASSIGNED_DRIVER]);
    }
    await this.checkDuplicates(scope, data, recordId);
    let row: DriverRow | null;
    try {
      row = await this.drivers.update(scope, recordId, data);
    } catch (error) {
      this.writeError(error);
    }
    if (row === null) {
      invalidFields([ASSIGNED_DRIVER]);
    }
    return row;
  }

  /** Drivers with trips or events cannot be deleted (composite foreign keys). */
  async delete(context: RequestContext, id: string): Promise<DriverResult> {
    const scope = requireScope(context);
    const row = await this.deleteStored(scope, uuid(id, 'id'));
    return this.completeOne(scope, row);
  }

  private async deleteStored(scope: FleetScope, recordId: string): Promise<DriverRow> {
    let row: DriverRow;
    try {
      row = await this.drivers.delete(scope, recordId);
    } catch (error) {
      persistenceError(error, 'Driver', DELETE_CONFLICT);
    }
    return row;
  }

  private async complete(
    scope: FleetScope,
    rows: readonly DriverRow[],
    today: string,
  ): Promise<DriverResult[]> {
    if (!rows.length) {
      return [];
    }
    return this.withStats(scope, rows, today, await this.telemetry.asOf(scope));
  }

  private async completeOne(scope: FleetScope, row: DriverRow): Promise<DriverResult> {
    const [driver] = await this.complete(scope, [row], await this.today(scope));
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return driver;
  }

  /**
   * Attaches the 30-day statistics before the data clock with one trip-facts and one event grouping
   * for the whole page; without device data every driver has zero distance and trips.
   */
  private async withStats(
    scope: FleetScope,
    rows: readonly DriverRow[],
    today: string,
    asOf: Date | null,
    capturedStats?: ReadonlyMap<string, DriverStats>,
  ): Promise<DriverResult[]> {
    const window = dataWindow(asOf, DRIVER_STATS_DAYS);
    const driverIds = rows.map((row) => row.id);
    const [totals, maneuvers] =
      window === null
        ? [new Map<string, DriverStats>(), new Map<string, number>()]
        : await Promise.all([
            capturedStats ?? this.drivers.stats(scope, driverIds, window),
            this.events.maneuverTotalsByDriver(scope, driverIds, window),
          ]);
    return rows.map((row) => {
      const total = totals.get(row.id);
      const distanceKm = total?.distance30dKm ?? 0;
      return {
        ...toDriver(row, today),
        distance30dKm: distanceKm,
        tripCount30d: total?.tripCount30d ?? 0,
        drivingScore30d: total?.drivingScore30d ?? null,
        maneuversPer100Km30d:
          window === null ? null : per100Km(maneuvers.get(row.id) ?? 0, distanceKm),
      };
    });
  }

  private async today(scope: FleetScope): Promise<string> {
    return businessDate(this.clock.now(), (await this.settings.read(scope)).timeZone);
  }

  private async checkDuplicates(
    scope: FleetScope,
    changes: Partial<DriverData>,
    excludeId: string | null,
  ): Promise<void> {
    const values = {
      employeeNumber: changes.employeeNumber ?? null,
      identificationKey: changes.identificationKey ?? null,
    };
    if (values.employeeNumber === null && values.identificationKey === null) {
      return;
    }
    const taken = await this.drivers.duplicates(scope, values, excludeId);
    const errors = [
      ...(taken.employeeNumber ? [DUPLICATE_EMPLOYEE_NUMBER] : []),
      ...(taken.identificationKey ? [DUPLICATE_IDENTIFICATION_KEY] : []),
    ];
    if (errors.length) {
      invalidFields(errors);
    }
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    persistenceError(error, 'Driver');
  }
}
