import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, businessDate, FleetClock } from '../../clock/fleet-clock.js';
import { DOCUMENT_EXPIRING_DAYS } from '../../fleet-thresholds.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import type {
  CreateFleetDriverInput,
  FleetDocumentStatus,
  FleetDriver,
  FleetDriverPage,
  FleetDriverSortField,
  QueryFleetDriversArgs,
  UpdateFleetDriverInput,
} from '../../generated/graphql/types.js';
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
  DriversRepository,
} from './drivers.repository.js';

export type DriverResult = FleetDriver;

const DRIVER_STATUSES = Object.values(FleetDriverStatus);
const LICENSE_CATEGORIES = Object.values(FleetLicenseCategory);
const SORT_FIELDS: readonly FleetDriverSortField[] = [
  'LAST_NAME',
  'EMPLOYEE_NUMBER',
  'LICENSE_EXPIRES_ON',
  'TACHOGRAPH_CARD_EXPIRES_ON',
  'CREATED_AT',
];

const DUPLICATE_EMPLOYEE_NUMBER: FieldError = {
  path: 'employeeNumber',
  message: 'Employee number is already used in this branch.',
};
const DUPLICATE_IDENTIFICATION_KEY: FieldError = {
  path: 'identificationKey',
  message: 'Identification key is already used in this branch.',
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
  if (expiresOn === null) return null;
  if (expiresOn < today) return 'EXPIRED';
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
  if (statuses.includes('EXPIRED')) return 'EXPIRED';
  if (statuses.includes('EXPIRING')) return 'EXPIRING';
  return statuses.includes('VALID') ? 'VALID' : 'NOT_RECORDED';
}

function toDriver(row: DriverRow, today: string): DriverResult {
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

@Injectable()
export class DriversService {
  constructor(
    private readonly drivers: DriversRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
  ) {}

  async list(context: RequestContext, args: QueryFleetDriversArgs): Promise<FleetDriverPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const today = businessDate(this.clock.now());
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
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'LAST_NAME'),
      direction: sortDirection(args.sort?.direction, 'ASC'),
    };
    const page = await this.drivers.list(scope, { offset, limit }, criteria, sort);
    return {
      items: page.items.map((row) => toDriver(row, today)),
      total: page.total,
      offset,
      limit,
    };
  }

  async find(context: RequestContext, id: string): Promise<DriverResult> {
    const row = await this.drivers.find(requireScope(context), uuid(id, 'id'));
    if (!row) throw new NotFoundException('Driver not found');
    return toDriver(row, businessDate(this.clock.now()));
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
    try {
      return toDriver(await this.drivers.create(scope, data), businessDate(this.clock.now()));
    } catch (error) {
      this.writeError(error);
    }
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetDriverInput,
  ): Promise<DriverResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const data: Partial<DriverData> = {};
    if (input.firstName !== undefined) data.firstName = text(input.firstName, 'firstName', 64);
    if (input.lastName !== undefined) data.lastName = text(input.lastName, 'lastName', 64);
    if (input.employeeNumber !== undefined)
      data.employeeNumber = fieldRules.employeeNumber(input.employeeNumber);
    if (input.identificationKey !== undefined)
      data.identificationKey = fieldRules.identificationKey(input.identificationKey);
    if (input.phone !== undefined) data.phone = fieldRules.phone(input.phone);
    if (input.email !== undefined) data.email = fieldRules.email(input.email);
    if (input.licenseNumber !== undefined)
      data.licenseNumber = fieldRules.licenseNumber(input.licenseNumber);
    if (input.licenseCategories !== undefined)
      data.licenseCategories = licenseCategories(input.licenseCategories);
    if (input.licenseExpiresOn !== undefined)
      data.licenseExpiresOn = expiryDate(input.licenseExpiresOn, 'licenseExpiresOn');
    if (input.tachographCardNumber !== undefined)
      data.tachographCardNumber = fieldRules.tachographCardNumber(input.tachographCardNumber);
    if (input.tachographCardExpiresOn !== undefined)
      data.tachographCardExpiresOn = expiryDate(
        input.tachographCardExpiresOn,
        'tachographCardExpiresOn',
      );
    if (input.status !== undefined)
      data.status = enumValue(input.status, DRIVER_STATUSES, 'status');
    if (input.notes !== undefined) data.notes = fieldRules.notes(input.notes);
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one driver field to update');
    const stored = await this.drivers.find(scope, recordId);
    if (!stored) throw new NotFoundException('Driver not found');
    if (data.status === 'INACTIVE' && stored.vehicles.length)
      invalid('status', 'Unassign the driver from its vehicles first.');
    await this.checkDuplicates(scope, data, recordId);
    try {
      return toDriver(
        await this.drivers.update(scope, recordId, data),
        businessDate(this.clock.now()),
      );
    } catch (error) {
      this.writeError(error);
    }
  }

  async delete(context: RequestContext, id: string): Promise<DriverResult> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    try {
      return toDriver(await this.drivers.delete(scope, recordId), businessDate(this.clock.now()));
    } catch (error) {
      persistenceError(error, 'Driver', DELETE_CONFLICT);
    }
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
    if (values.employeeNumber === null && values.identificationKey === null) return;
    const taken = await this.drivers.duplicates(scope, values, excludeId);
    const errors = [
      ...(taken.employeeNumber ? [DUPLICATE_EMPLOYEE_NUMBER] : []),
      ...(taken.identificationKey ? [DUPLICATE_IDENTIFICATION_KEY] : []),
    ];
    if (errors.length) invalidFields(errors);
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    persistenceError(error, 'Driver');
  }
}
