import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, nullsLast, prismaDirection } from '../../database/search.js';
import type { FleetDriverSortField } from '../../generated/graphql/types.js';
import type { FleetDriverStatus, FleetLicenseCategory } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** Current vehicles (by plate) are loaded with every driver through the composite relation. */
const driverInclude = {
  vehicles: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
    orderBy: [{ licensePlate: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.DriverInclude;

export type DriverRow = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

export interface DriverData {
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
  identificationKey: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  licenseCategories: FleetLicenseCategory[];
  licenseExpiresOn: Date | null;
  tachographCardNumber: string | null;
  tachographCardExpiresOn: Date | null;
  status: FleetDriverStatus;
  notes: string | null;
}

/** Validated list arguments; `undefined` means no constraint. */
export interface DriverListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  statuses: FleetDriverStatus[] | undefined;
  licenseCategories: FleetLicenseCategory[] | undefined;
  /** Licence or tachograph card expiring on or before this UTC-midnight date. */
  documentsExpireBy: Date | undefined;
  hasVehicle: boolean | undefined;
}

export interface DriverSort {
  field: FleetDriverSortField;
  direction: SortDirection;
}

function driverWhere(scope: FleetScope, criteria: DriverListCriteria): Prisma.DriverWhereInput {
  const conditions: Prisma.DriverWhereInput[] = criteria.tokens.map((token) => {
    const contains = literalContains(token);
    return {
      OR: [
        { firstName: contains },
        { lastName: contains },
        { employeeNumber: contains },
        { identificationKey: contains },
        { phone: contains },
      ],
    };
  });
  if (criteria.ids) conditions.push({ id: { in: criteria.ids } });
  if (criteria.statuses) conditions.push({ status: { in: criteria.statuses } });
  if (criteria.licenseCategories)
    conditions.push({ licenseCategories: { hasSome: criteria.licenseCategories } });
  if (criteria.documentsExpireBy)
    conditions.push({
      OR: [
        { licenseExpiresOn: { lte: criteria.documentsExpireBy } },
        { tachographCardExpiresOn: { lte: criteria.documentsExpireBy } },
      ],
    });
  if (criteria.hasVehicle !== undefined)
    conditions.push({ vehicles: criteria.hasVehicle ? { some: {} } : { none: {} } });
  return { tenantId: scope.tenantId, branchId: scope.branchId, AND: conditions };
}

@Injectable()
export class DriversRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: DriverListCriteria,
    sort: DriverSort,
  ): Promise<{ items: DriverRow[]; total: number }> {
    const where = driverWhere(scope, criteria);
    const direction = prismaDirection(sort.direction);
    const ordering: Record<FleetDriverSortField, Prisma.DriverOrderByWithRelationInput[]> = {
      LAST_NAME: [{ lastName: direction }, { firstName: direction }],
      EMPLOYEE_NUMBER: [{ employeeNumber: nullsLast(sort.direction) }],
      LICENSE_EXPIRES_ON: [{ licenseExpiresOn: nullsLast(sort.direction) }],
      TACHOGRAPH_CARD_EXPIRES_ON: [{ tachographCardExpiresOn: nullsLast(sort.direction) }],
      CREATED_AT: [{ createdAt: direction }],
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.driver.findMany({
          where,
          include: driverInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [...ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.driver.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }

  find(scope: FleetScope, id: string): Promise<DriverRow | null> {
    return this.prisma.client.driver.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: driverInclude,
    });
  }

  /** Stored values among `employeeNumber`/`identificationKey` used by another driver. */
  async duplicates(
    scope: FleetScope,
    values: { employeeNumber: string | null; identificationKey: string | null },
    excludeId: string | null,
  ): Promise<{ employeeNumber: boolean; identificationKey: boolean }> {
    const candidates: Prisma.DriverWhereInput[] = [];
    if (values.employeeNumber !== null) candidates.push({ employeeNumber: values.employeeNumber });
    if (values.identificationKey !== null)
      candidates.push({ identificationKey: values.identificationKey });
    if (!candidates.length) return { employeeNumber: false, identificationKey: false };
    const rows = await this.prisma.client.driver.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
        OR: candidates,
      },
      select: { employeeNumber: true, identificationKey: true },
      take: 2,
    });
    return {
      employeeNumber:
        values.employeeNumber !== null &&
        rows.some((row) => row.employeeNumber === values.employeeNumber),
      identificationKey:
        values.identificationKey !== null &&
        rows.some((row) => row.identificationKey === values.identificationKey),
    };
  }

  create(scope: FleetScope, data: DriverData): Promise<DriverRow> {
    return this.prisma.client.driver.create({
      data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
      include: driverInclude,
    });
  }

  update(scope: FleetScope, id: string, data: Partial<DriverData>): Promise<DriverRow> {
    return this.prisma.client.driver.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data,
      include: driverInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<DriverRow> {
    return this.prisma.client.driver.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: driverInclude,
    });
  }
}
