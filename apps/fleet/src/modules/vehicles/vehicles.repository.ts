import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { dateOrNull, integer, rowsOf, text } from '../../database/sql.js';
import type {
  FleetVehicleSortField,
  FleetVehicleState,
  FleetVehicleSummary,
} from '../../generated/graphql/types.js';
import type {
  FleetFuelType,
  FleetVehicleStatus,
  FleetVehicleType,
} from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';
import { lockDriverStatus } from '../drivers/drivers.repository.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';
import { parseVehicleFacts } from '../telemetry/telemetry.repository.js';
import { classifyVehicleState } from '../telemetry/vehicle-state.js';
import {
  vehicleListOrderSql,
  vehicleListRowsSql,
  vehicleListWhereSql,
} from './vehicle-list.sql.js';
import type { VehicleConditionCriteria } from './vehicle-filter.js';

/** Stored references and the device count are loaded with every vehicle (no per-row query). */
const vehicleInclude = {
  group: { select: { id: true, name: true, colorToken: true } },
  currentDriver: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, status: true },
  },
  _count: { select: { devices: true } },
} satisfies Prisma.VehicleInclude;

export type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;
export type VehicleListRow = VehicleRow & {
  state: FleetVehicleState;
  openAlertCount: number;
};

export interface VehicleData {
  licensePlate: string;
  notes: string | null;
  fleetNumber: string | null;
  vehicleType: FleetVehicleType | null;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  vin: string | null;
  fuelType: FleetFuelType | null;
  fuelTankCapacityL: number | null;
  status: FleetVehicleStatus;
  groupId: string | null;
  currentDriverId: string | null;
}

/** Validated list arguments; `undefined` means no constraint. */
export interface VehicleListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  statuses: FleetVehicleStatus[] | undefined;
  vehicleTypes: FleetVehicleType[] | undefined;
  fuelTypes: FleetFuelType[] | undefined;
  groupIds: string[] | undefined;
  hasGroup: boolean | undefined;
  currentDriverIds: string[] | undefined;
  hasDriver: boolean | undefined;
  hasDevice: boolean | undefined;
  hasOpenAlerts: boolean | undefined;
  allOf?: VehicleConditionCriteria[] | undefined;
}

export interface VehicleSort {
  field: FleetVehicleSortField;
  direction: SortDirection;
}

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: VehicleListCriteria,
    sort: VehicleSort,
  ): Promise<{ items: VehicleListRow[]; total: number }> {
    const base = vehicleListRowsSql(this.prisma.schema, scope);
    const where = vehicleListWhereSql(this.prisma.schema, scope, criteria);
    const order = vehicleListOrderSql(sort);
    return this.prisma.client.$transaction(
      async (transaction) => {
        const selected: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH vehicles AS (${base})
          SELECT v."id"::text AS "id", v."status", v."hasDevice", v."sampleRecordedAt",
            v."latitude", v."longitude", v."address", v."speedKph", v."headingDeg", v."ignition",
            v."fuelLevelPct", v."externalVoltage", v."backupBatteryVoltage", v."engineHours",
            v."coolantTempC", v."odometerKm", v."odometerRecordedAt", v."odometerSource",
            v."asOf", v."openAlertCount", v."lowFuelPct", v."notReportingHours" FROM vehicles v
          WHERE ${where} ORDER BY ${order} LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const counted: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH vehicles AS (${base}) SELECT count(*)::int AS "total" FROM vehicles v WHERE ${where}`);
        const facts = rowsOf(selected, (row) => ({
          id: text(row, 'id'),
          state: classifyVehicleState(parseVehicleFacts(row), dateOrNull(row, 'asOf'), {
            lowFuelPct: integer(row, 'lowFuelPct'),
            notReportingHours: integer(row, 'notReportingHours'),
          }),
          openAlertCount: integer(row, 'openAlertCount'),
        }));
        const ids = facts.map((row) => row.id);
        const [total] = rowsOf(counted, (row) => integer(row, 'total'));
        const rows = ids.length
          ? await transaction.vehicle.findMany({
              where: { tenantId: scope.tenantId, branchId: scope.branchId, id: { in: ids } },
              include: vehicleInclude,
            })
          : [];
        const byId = new Map(rows.map((row) => [row.id, row]));
        const items = facts.map((fact) => {
          const row = byId.get(fact.id);
          if (!row) {
            throw new Error('Missing vehicle in the list snapshot.');
          }
          return { ...row, state: fact.state, openAlertCount: fact.openAlertCount };
        });
        return { items, total: total ?? 0 };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async summary(scope: FleetScope): Promise<FleetVehicleSummary> {
    const base = vehicleListRowsSql(this.prisma.schema, scope);
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH vehicles AS (${base}), clock AS (${vehicleDataClockSql(this.prisma.schema, scope)})
      SELECT (SELECT "asOf" FROM clock) AS "dataAsOf",
        count(*) FILTER (WHERE v."status" <> 'INACTIVE')::int AS "inOperation",
        count(*) FILTER (WHERE v."status" = 'IN_WORKSHOP')::int AS "inWorkshop",
        count(*) FILTER (WHERE v."activity" = 'MOVING')::int AS "moving",
        count(*) FILTER (WHERE v."activity" = 'NOT_CONNECTED')::int AS "notReporting",
        coalesce(sum(v."openAlertCount"), 0)::int AS "openAlerts",
        count(*) FILTER (WHERE v."fuelStatus" = 'LOW')::int AS "lowFuel"
      FROM vehicles v`);
    const [summary] = rowsOf(rows, (row) => ({
      dataAsOf: dateOrNull(row, 'dataAsOf'),
      inOperation: integer(row, 'inOperation'),
      inWorkshop: integer(row, 'inWorkshop'),
      moving: integer(row, 'moving'),
      notReporting: integer(row, 'notReporting'),
      openAlerts: integer(row, 'openAlerts'),
      lowFuel: integer(row, 'lowFuel'),
    }));
    if (!summary) {
      throw new Error('Missing vehicle summary.');
    }
    return summary;
  }

  find(scope: FleetScope, id: string): Promise<VehicleRow | null> {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: vehicleInclude,
    });
  }

  findGroup(scope: FleetScope, id: string) {
    return this.prisma.client.vehicleGroup.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
  }

  findDriver(scope: FleetScope, id: string) {
    return this.prisma.client.driver.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true, status: true },
    });
  }

  /** Stored values among `fleetNumber`/`vin` already used by another vehicle of the Branch. */
  async duplicates(
    scope: FleetScope,
    values: { fleetNumber: string | null; vin: string | null },
    excludeId: string | null,
  ): Promise<{ fleetNumber: boolean; vin: boolean }> {
    const candidates: Prisma.VehicleWhereInput[] = [];
    if (values.fleetNumber !== null) {
      candidates.push({ fleetNumber: values.fleetNumber });
    }
    if (values.vin !== null) {
      candidates.push({ vin: values.vin });
    }
    if (!candidates.length) {
      return { fleetNumber: false, vin: false };
    }
    const rows = await this.prisma.client.vehicle.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
        OR: candidates,
      },
      select: { fleetNumber: true, vin: true },
      take: 2,
    });
    return {
      fleetNumber:
        values.fleetNumber !== null && rows.some((row) => row.fleetNumber === values.fleetNumber),
      vin: values.vin !== null && rows.some((row) => row.vin === values.vin),
    };
  }

  create(scope: FleetScope, data: VehicleData): Promise<VehicleRow | null> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        if (data.currentDriverId !== null) {
          const status = await lockDriverStatus(
            transaction,
            this.prisma.schema,
            scope,
            data.currentDriverId,
          );
          if (status === null || status === 'INACTIVE') {
            return null;
          }
        }
        return transaction.vehicle.create({
          data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
          include: vehicleInclude,
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  update(scope: FleetScope, id: string, data: Partial<VehicleData>): Promise<VehicleRow | null> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        if (data.currentDriverId != null) {
          const status = await lockDriverStatus(
            transaction,
            this.prisma.schema,
            scope,
            data.currentDriverId,
          );
          if (status === null || status === 'INACTIVE') {
            return null;
          }
        }
        return transaction.vehicle.update({
          where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
          data,
          include: vehicleInclude,
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  /** Sets INACTIVE and clears the current driver in one scoped update. */
  deactivate(scope: FleetScope, id: string): Promise<VehicleRow> {
    return this.prisma.client.vehicle.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data: { status: 'INACTIVE', currentDriverId: null },
      include: vehicleInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<VehicleRow> {
    return this.prisma.client.vehicle.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: vehicleInclude,
    });
  }
}
