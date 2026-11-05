import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { dateOrNull, integer, oneOf, rowsOf, text } from '../../database/sql.js';
import type {
  FleetDeviceSortField,
  FleetDeviceStatus,
  FleetDeviceSummary,
} from '../../generated/graphql/types.js';
import type { FleetDeviceModel, FleetDeviceOption } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';
import type { DeviceConditionCriteria } from './device-filter.js';
import { deviceListOrderSql, deviceListRowsSql, deviceListWhereSql } from './device-list.sql.js';
import { DEVICE_STATUSES } from './device-state.js';

/** The vehicle reference is loaded with every device through the composite relation. */
const deviceInclude = {
  ermCursor: { select: { lastReceivedAt: true } },
  vehicle: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
  },
} satisfies Prisma.DeviceInclude;

export type DeviceRow = Prisma.DeviceGetPayload<{ include: typeof deviceInclude }>;
export type DeviceListRow = DeviceRow & {
  status: FleetDeviceStatus;
  lastReportedAt: Date | null;
};

export interface DeviceData {
  imei: string;
  vehicleId: string | null;
  model: FleetDeviceModel | null;
  serialNumber: string | null;
  options: FleetDeviceOption[];
  firmwareVersion: string | null;
  edataModule: string | null;
  simPhoneNumber: string | null;
  simIccid: string | null;
  smsPassword: string | null;
  installedAt: Date | null;
  notes: string | null;
}

/** Validated list arguments; `undefined` means no constraint. */
export interface DeviceListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  models: FleetDeviceModel[] | undefined;
  options: FleetDeviceOption[] | undefined;
  vehicleIds: string[] | undefined;
  allOf?: DeviceConditionCriteria[] | undefined;
}

export interface DeviceSort {
  field: FleetDeviceSortField;
  direction: SortDirection;
}

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: DeviceListCriteria,
    sort: DeviceSort,
  ): Promise<{ items: DeviceListRow[]; total: number }> {
    const base = deviceListRowsSql(this.prisma.schema, scope);
    const where = deviceListWhereSql(criteria);
    const order = deviceListOrderSql(sort);
    return this.prisma.client.$transaction(
      async (transaction) => {
        const selected: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH devices AS (${base}) SELECT d."id"::text AS "id", d."status", d."lastReportedAt" FROM devices d
          WHERE ${where} ORDER BY ${order} LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const counted: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH devices AS (${base}) SELECT count(*)::int AS "total" FROM devices d WHERE ${where}`);
        const facts = rowsOf(selected, (row) => ({
          id: text(row, 'id'),
          status: oneOf(row, 'status', DEVICE_STATUSES),
          lastReportedAt: dateOrNull(row, 'lastReportedAt'),
        }));
        const ids = facts.map((row) => row.id);
        const [total] = rowsOf(counted, (row) => integer(row, 'total'));
        const rows = ids.length
          ? await transaction.device.findMany({
              where: { tenantId: scope.tenantId, branchId: scope.branchId, id: { in: ids } },
              include: deviceInclude,
            })
          : [];
        const byId = new Map(rows.map((row) => [row.id, row]));
        const items = facts.map((fact) => {
          const row = byId.get(fact.id);
          if (!row) {
            throw new Error('Missing device in the list snapshot.');
          }
          return { ...row, status: fact.status, lastReportedAt: fact.lastReportedAt };
        });
        return { items, total: total ?? 0 };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async summary(scope: FleetScope): Promise<FleetDeviceSummary> {
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH devices AS (${deviceListRowsSql(this.prisma.schema, scope)}),
      clock AS (${vehicleDataClockSql(this.prisma.schema, scope)})
      SELECT (SELECT "asOf" FROM clock) AS "dataAsOf",
        count(*) FILTER (WHERE d."status" = 'ONLINE')::int AS "online",
        count(*) FILTER (WHERE d."status" = 'OFFLINE')::int AS "offline",
        count(*) FILTER (WHERE d."status" = 'IN_STOCK')::int AS "inStock" FROM devices d`);
    const [summary] = rowsOf(rows, (row) => ({
      dataAsOf: dateOrNull(row, 'dataAsOf'),
      online: integer(row, 'online'),
      offline: integer(row, 'offline'),
      inStock: integer(row, 'inStock'),
    }));
    if (!summary) {
      throw new Error('Missing device summary.');
    }
    return summary;
  }

  find(scope: FleetScope, id: string): Promise<DeviceRow | null> {
    return this.prisma.client.device.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }

  forVehicles(scope: FleetScope, vehicleIds: readonly string[]): Promise<DeviceRow[]> {
    return this.prisma.client.device.findMany({
      where: { ...scope, vehicleId: { in: [...vehicleIds] } },
      include: deviceInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async diagnostics(scope: FleetScope, pairs: readonly { vehicleId: string; imei: string }[]) {
    const where: Prisma.FleetEventWhereInput = {
      ...scope,
      OR: pairs.map((pair) => ({ vehicleId: pair.vehicleId, deviceImei: pair.imei })),
      kind: { in: ['DIAGNOSTIC_TROUBLE_CODE', 'CAN_ERROR', 'CAN_DISCONNECTED'] },
    };
    const [counts, latest] = await this.prisma.client.$transaction(
      [
        this.prisma.client.fleetEvent.groupBy({
          by: ['vehicleId', 'deviceImei'],
          where,
          _count: { _all: true },
        }),
        this.prisma.client.fleetEvent.findMany({
          where,
          distinct: ['vehicleId', 'deviceImei'],
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          select: {
            vehicleId: true,
            deviceImei: true,
            kind: true,
            occurredAt: true,
            troubleCode: true,
            details: true,
            source: true,
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { counts, latest };
  }

  routing(scope: FleetScope, imeis: string[]) {
    return this.prisma.client.karmaMonitoringTruck.findMany({
      where: { ...scope, karmaDeviceId: { in: imeis } },
      select: {
        karmaDeviceId: true,
        routing: true,
        backupSince: true,
        lastBackupStartedAt: true,
        lastBackupEndedAt: true,
        backupSeconds: true,
        recoveryAttempts: {
          where: scope,
          orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
  }

  findVehicle(scope: FleetScope, id: string) {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
  }

  /** Deliberately unscoped Device read across all Tenants/Branches; returns only a boolean. */
  async imeiTaken(imei: string, excludeId: string | null): Promise<boolean> {
    const row = await this.prisma.client.device.findFirst({
      where: {
        imei,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async serialNumberTaken(
    scope: FleetScope,
    serialNumber: string,
    excludeId: string | null,
  ): Promise<boolean> {
    const row = await this.prisma.client.device.findFirst({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        serialNumber,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return row !== null;
  }

  create(scope: FleetScope, data: DeviceData): Promise<DeviceRow> {
    return this.prisma.client.device.create({
      data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }

  update(scope: FleetScope, id: string, data: Partial<DeviceData>): Promise<DeviceRow> {
    return this.prisma.client.device.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data,
      include: deviceInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<DeviceRow> {
    return this.prisma.client.device.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }
}
