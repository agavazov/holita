import { Injectable } from '@nestjs/common';
import type { DataWindow } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  dateOrNull,
  fleetTable,
  integer,
  number,
  numberOrNull,
  oneOf,
  rowsOf,
  text,
} from '../../database/sql.js';
import type {
  FleetDriver,
  FleetDriverSortField,
  FleetDriverSummary,
} from '../../generated/graphql/types.js';
import { FleetDriverStatus, type FleetLicenseCategory } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';
import type { DriverConditionCriteria } from './driver-filter.js';
import { driverFactsSql } from './driver-facts.sql.js';
import { driverListOrderSql, driverListWhereSql } from './driver-list.sql.js';

const DRIVER_STATUSES = Object.values(FleetDriverStatus);

/**
 * Deactivation and Vehicle writes setting a driver take this scoped lock first. NO KEY UPDATE
 * serializes those checks without blocking the foreign-key KEY SHARE locks of other inserts.
 */
export async function lockDriverStatus(
  transaction: Prisma.TransactionClient,
  schema: string,
  scope: FleetScope,
  id: string,
): Promise<FleetDriverStatus | null> {
  const locked: unknown = await transaction.$queryRaw(Prisma.sql`
    SELECT "status"::text AS "status" FROM ${fleetTable(schema, 'Driver')}
    WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
      AND "id" = ${id}::uuid FOR NO KEY UPDATE`);
  return rowsOf(locked, (row) => oneOf(row, 'status', DRIVER_STATUSES))[0] ?? null;
}

/** Current vehicles (by plate) are loaded with every driver through the composite relation. */
const driverInclude = {
  vehicles: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
    orderBy: [{ licensePlate: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.DriverInclude;

export type DriverRow = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;
export type DriverStats = Pick<FleetDriver, 'distance30dKm' | 'tripCount30d' | 'drivingScore30d'>;
export type DriverListRow = DriverRow & DriverStats & { dataAsOf: Date | null };

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
  allOf?: DriverConditionCriteria[] | undefined;
}

export interface DriverSort {
  field: FleetDriverSortField;
  direction: SortDirection;
}

@Injectable()
export class DriversRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: DriverListCriteria,
    sort: DriverSort,
  ): Promise<{ items: DriverListRow[]; total: number }> {
    const base = driverFactsSql(this.prisma.schema, scope);
    const where = driverListWhereSql(this.prisma.schema, scope, criteria);
    const order = driverListOrderSql(sort);
    return this.prisma.client.$transaction(
      async (transaction) => {
        const selected: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH drivers AS (${base}) SELECT d."id"::text AS "id", d."asOf", d."distance30dKm",
            d."tripCount30d", d."drivingScore30d" FROM drivers d
          WHERE ${where} ORDER BY ${order} LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const counted: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH drivers AS (${base}) SELECT count(*)::int AS "total" FROM drivers d WHERE ${where}`);
        const facts = rowsOf(selected, (row) => ({
          id: text(row, 'id'),
          dataAsOf: dateOrNull(row, 'asOf'),
          distance30dKm: number(row, 'distance30dKm'),
          tripCount30d: integer(row, 'tripCount30d'),
          drivingScore30d: numberOrNull(row, 'drivingScore30d'),
        }));
        const ids = facts.map((row) => row.id);
        const [total] = rowsOf(counted, (row) => integer(row, 'total'));
        const rows = ids.length
          ? await transaction.driver.findMany({
              where: { tenantId: scope.tenantId, branchId: scope.branchId, id: { in: ids } },
              include: driverInclude,
            })
          : [];
        const byId = new Map(rows.map((row) => [row.id, row]));
        const items = facts.map((fact) => {
          const row = byId.get(fact.id);
          if (!row) {
            throw new Error('Missing driver in the list snapshot.');
          }
          return { ...row, ...fact };
        });
        return { items, total: total ?? 0 };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** One page-wide read of exactly the same 30-day facts used by list filtering and sorting. */
  async stats(
    scope: FleetScope,
    driverIds: readonly string[],
    window: DataWindow,
  ): Promise<Map<string, DriverStats>> {
    if (!driverIds.length) {
      return new Map();
    }
    const base = driverFactsSql(this.prisma.schema, scope, window);
    const selected: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH drivers AS (${base}) SELECT d."id"::text AS "id", d."distance30dKm", d."tripCount30d", d."drivingScore30d"
      FROM drivers d WHERE d."id" = ANY(${driverIds}::uuid[])`);
    const rows = rowsOf(selected, (row) => ({
      id: text(row, 'id'),
      distance30dKm: number(row, 'distance30dKm'),
      tripCount30d: integer(row, 'tripCount30d'),
      drivingScore30d: numberOrNull(row, 'drivingScore30d'),
    }));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async summary(scope: FleetScope, documentsExpireBy: Date): Promise<FleetDriverSummary> {
    const base = driverFactsSql(this.prisma.schema, scope);
    const selected: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH drivers AS (${base}), summary_clock AS (${vehicleDataClockSql(this.prisma.schema, scope)})
      SELECT (SELECT "asOf" FROM summary_clock) AS "dataAsOf",
        count(*) FILTER (WHERE d."status" = 'ACTIVE')::int AS "active",
        count(*) FILTER (WHERE d."status" = 'ON_LEAVE')::int AS "onLeave",
        count(*) FILTER (WHERE d."licenseExpiresOn" <= ${documentsExpireBy}::date
          OR d."tachographCardExpiresOn" <= ${documentsExpireBy}::date)::int AS "documentsExpiring",
        avg(d."drivingScore30d")::float8 AS "averageDrivingScore",
        coalesce(sum(d."distance30dKm"), 0)::float8 AS "distance30dKm"
      FROM drivers d`);
    const [summary] = rowsOf(selected, (row) => ({
      dataAsOf: dateOrNull(row, 'dataAsOf'),
      active: integer(row, 'active'),
      onLeave: integer(row, 'onLeave'),
      documentsExpiring: integer(row, 'documentsExpiring'),
      averageDrivingScore: numberOrNull(row, 'averageDrivingScore'),
      distance30dKm: number(row, 'distance30dKm'),
    }));
    if (!summary) {
      throw new Error('Missing driver summary.');
    }
    return summary;
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
    if (values.employeeNumber !== null) {
      candidates.push({ employeeNumber: values.employeeNumber });
    }
    if (values.identificationKey !== null) {
      candidates.push({ identificationKey: values.identificationKey });
    }
    if (!candidates.length) {
      return { employeeNumber: false, identificationKey: false };
    }
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

  update(scope: FleetScope, id: string, data: Partial<DriverData>): Promise<DriverRow | null> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        if (data.status === 'INACTIVE') {
          await lockDriverStatus(transaction, this.prisma.schema, scope, id);
          const assigned = await transaction.vehicle.count({
            where: { tenantId: scope.tenantId, branchId: scope.branchId, currentDriverId: id },
          });
          if (assigned) {
            return null;
          }
        }
        return transaction.driver.update({
          where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
          data,
          include: driverInclude,
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  delete(scope: FleetScope, id: string): Promise<DriverRow> {
    return this.prisma.client.driver.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: driverInclude,
    });
  }
}
