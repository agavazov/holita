import { Injectable } from '@nestjs/common';
import {
  fleetDataSourceDb,
  fleetVehicleStatusDb,
  fleetVehicleTypeDb,
} from '../../database/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  databaseEnum,
  date,
  dateOrNull,
  fleetTable,
  integer,
  integerOrNull,
  number,
  numberOrNull,
  oneOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import type { FleetMapPosition, FleetVehicleRef } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { settingsSql } from '../settings/settings.sql.js';
import {
  vehicleActivitySql,
  vehicleDataClockSql,
  vehicleFactsSql,
} from '../telemetry/vehicle-facts.sql.js';

function factsSql(schema: string, scope: FleetScope) {
  return Prisma.sql`WITH clock AS (${vehicleDataClockSql(schema, scope)}),
    settings AS (${settingsSql(schema, scope)}), facts AS (
      SELECT f.*, ${vehicleActivitySql(Prisma.sql`settings."notReportingHours"`)} AS "activity"
      FROM (${vehicleFactsSql(schema, scope)}) f CROSS JOIN clock CROSS JOIN settings
    )`;
}

function positionSql(schema: string, scope: FleetScope) {
  return Prisma.sql`SELECT s."id", s."deviceImei", s."source", s."latitude", s."longitude",
    s."speedKph", s."headingDeg", s."recordedAt", s."receivedAt"
    FROM ${fleetTable(schema, 'vehicleStatusSample')} s
    WHERE s."tenantId"=${scope.tenantId}::uuid AND s."branchId"=${scope.branchId}::uuid
      AND s."vehicleId"=v."id" AND s."deviceImei" IS NOT NULL
      AND s."latitude" IS NOT NULL AND s."longitude" IS NOT NULL
    ORDER BY s."recordedAt" DESC,s."id" DESC LIMIT 1`;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Complete scoped registry, never the first page of fleetDevices. */
  private devices(transaction: Prisma.TransactionClient, scope: FleetScope) {
    return transaction.device.findMany({
      where: { ...scope },
      select: { id: true, imei: true, vehicleId: true },
      orderBy: { id: 'asc' },
    });
  }

  dashboard(scope: FleetScope, period: { from: Date; to: Date }) {
    const schema = this.prisma.schema;
    return this.prisma.client.$transaction(
      async (transaction) => {
        const rows: unknown = await transaction.$queryRaw(Prisma.sql`${factsSql(schema, scope)}
        SELECT clock."asOf" AS "dataAsOf",
          (SELECT count(*)::int FROM facts) AS "total",
          (SELECT count(*)::int FROM facts WHERE "activity"='MOVING') AS "moving",
          (SELECT count(*)::int FROM facts WHERE "activity"='IDLE') AS "idle",
          (SELECT count(*)::int FROM facts WHERE "activity"='PARKED') AS "parked",
          (SELECT count(*)::int FROM facts WHERE "activity"='NOT_CONNECTED') AS "notReporting",
          (SELECT count(*)::int FROM facts WHERE "activity"='ASSET') AS "asset",
          (SELECT count(*)::int FROM facts WHERE "activity"='NO_DEVICE') AS "noDevice",
          t."tripCount",t."distanceKm",t."distanceKnownTrips"
        FROM clock CROSS JOIN LATERAL (
          SELECT count(*)::int AS "tripCount",sum(t."distanceKm")::float8 AS "distanceKm",
            count(t."distanceKm")::int AS "distanceKnownTrips"
          FROM ${fleetTable(schema, 'trip')} t
          WHERE t."tenantId"=${scope.tenantId}::uuid AND t."branchId"=${scope.branchId}::uuid
            AND t."startedAt">=${period.from} AND t."startedAt"<${period.to}
            AND t."startedAt"<=clock."asOf"
        ) t`);
        const [summary] = rowsOf(rows, (row) => ({
          dataAsOf: dateOrNull(row, 'dataAsOf'),
          total: integer(row, 'total'),
          moving: integer(row, 'moving'),
          idle: integer(row, 'idle'),
          parked: integer(row, 'parked'),
          notReporting: integer(row, 'notReporting'),
          asset: integer(row, 'asset'),
          noDevice: integer(row, 'noDevice'),
          tripCount: integer(row, 'tripCount'),
          distanceKm: numberOrNull(row, 'distanceKm'),
          distanceKnownTrips: integer(row, 'distanceKnownTrips'),
        }));
        if (!summary) {
          throw new Error('Missing Fleet dashboard snapshot');
        }
        return { ...summary, devices: await this.devices(transaction, scope) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  map(scope: FleetScope, page: { offset: number; limit: number }, now: Date) {
    const schema = this.prisma.schema;
    return this.prisma.client.$transaction(
      async (transaction) => {
        const coverage: unknown = await transaction.$queryRaw(Prisma.sql`
        SELECT (SELECT "asOf" FROM (${vehicleDataClockSql(schema, scope)}) clock) AS "dataAsOf",
          count(*)::int AS "total", count(p."id")::int AS "withPosition"
        FROM ${fleetTable(schema, 'vehicle')} v LEFT JOIN LATERAL (${positionSql(schema, scope)}) p ON TRUE
        WHERE v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid`);
        const [summary] = rowsOf(coverage, (row) => ({
          dataAsOf: dateOrNull(row, 'dataAsOf'),
          total: integer(row, 'total'),
          withPosition: integer(row, 'withPosition'),
        }));
        if (!summary) {
          throw new Error('Missing Fleet map coverage');
        }
        const selected: unknown = await transaction.$queryRaw(Prisma.sql`${factsSql(schema, scope)}
        SELECT v."id"::text AS "id",v."licensePlate",v."fleetNumber",v."vehicleType"::text AS "vehicleType",v."status"::text AS "status",f."activity",
          p."id"::text AS "sampleId",p."deviceImei",p."source"::text AS "source",p."latitude",p."longitude",p."speedKph",p."headingDeg"::int AS "headingDeg",p."recordedAt",p."receivedAt"
        FROM ${fleetTable(schema, 'vehicle')} v JOIN facts f ON f."id"=v."id"::text
        LEFT JOIN LATERAL (${positionSql(schema, scope)}) p ON TRUE
        WHERE v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid
        ORDER BY v."id" ASC LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const items = rowsOf(selected, (row) => {
          const vehicle: FleetVehicleRef = {
            id: text(row, 'id'),
            licensePlate: text(row, 'licensePlate'),
            fleetNumber: textOrNull(row, 'fleetNumber'),
            vehicleType:
              row.vehicleType === null
                ? null
                : databaseEnum(row, 'vehicleType', fleetVehicleTypeDb),
            status: databaseEnum(row, 'status', fleetVehicleStatusDb),
          };
          const sampleId = textOrNull(row, 'sampleId');
          const position: FleetMapPosition | null =
            sampleId === null
              ? null
              : {
                  sampleId,
                  deviceImei: text(row, 'deviceImei'),
                  source: databaseEnum(row, 'source', fleetDataSourceDb),
                  latitude: number(row, 'latitude'),
                  longitude: number(row, 'longitude'),
                  speedKph: numberOrNull(row, 'speedKph'),
                  headingDeg: integerOrNull(row, 'headingDeg'),
                  recordedAt: date(row, 'recordedAt'),
                  receivedAt: date(row, 'receivedAt'),
                  ageSeconds: Math.max(
                    0,
                    (now.getTime() - date(row, 'recordedAt').getTime()) / 1000,
                  ),
                };
          return {
            vehicle,
            position,
            activity: oneOf(row, 'activity', [
              'MOVING',
              'IDLE',
              'PARKED',
              'ASSET',
              'NOT_CONNECTED',
              'NO_DEVICE',
            ] as const),
          };
        });
        const ids = items.map((item) => item.vehicle.id);
        const devices = await transaction.device.findMany({
          where: { ...scope, vehicleId: { in: ids } },
          select: { id: true, imei: true, vehicleId: true },
          orderBy: { id: 'asc' },
        });
        return { ...summary, items, devices };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
