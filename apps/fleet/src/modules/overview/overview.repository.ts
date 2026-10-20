import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  dateOrNull,
  fleetTable,
  integer,
  number,
  rowsOf,
  text,
  textOrNull,
  oneOf,
} from '../../database/sql.js';
import type {
  FleetDailyDistancePoint,
  FleetGroupActivity,
  FleetOverview,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FleetGroupColor } from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';
import { serviceTasksWithUrgency } from '../service-tasks/service-urgency.sql.js';
import {
  vehicleDataClockSql,
  vehicleFactsSql,
  vehicleActivitySql,
} from '../telemetry/vehicle-facts.sql.js';
import { settingsSql } from '../settings/settings.sql.js';

/** One scoped trip aggregate per calendar day; no sample cap or client-side history reduction. */
function dailyDistanceSql(
  schema: string,
  scope: FleetScope,
  days: number,
  vehicleId: string | undefined,
): Prisma.Sql {
  const trips = fleetTable(schema, 'Trip');
  return Prisma.sql`WITH clock AS (${vehicleDataClockSql(schema, scope)}), settings AS (${settingsSql(schema, scope)}), dates AS (
    SELECT generate_series((clock."asOf" AT TIME ZONE settings."timeZone")::date - (${days}::int - 1),
      (clock."asOf" AT TIME ZONE settings."timeZone")::date, INTERVAL '1 day')::date AS "date"
    FROM clock CROSS JOIN settings WHERE clock."asOf" IS NOT NULL
  ), distances AS (
    SELECT (t."startedAt" AT TIME ZONE settings."timeZone")::date AS "date", sum(t."distanceKm")::float8 AS "distanceKm"
    FROM ${trips} t CROSS JOIN clock CROSS JOIN settings
    WHERE t."tenantId"=${scope.tenantId}::uuid AND t."branchId"=${scope.branchId}::uuid
      AND t."startedAt" <= clock."asOf"
      AND (t."startedAt" AT TIME ZONE settings."timeZone")::date >= (clock."asOf" AT TIME ZONE settings."timeZone")::date - (${days}::int - 1)
      ${vehicleId === undefined ? Prisma.empty : Prisma.sql`AND t."vehicleId"=${vehicleId}::uuid`}
    GROUP BY (t."startedAt" AT TIME ZONE settings."timeZone")::date
  ) SELECT dates."date"::text AS "date", coalesce(d."distanceKm",0)::float8 AS "distanceKm"
    FROM dates LEFT JOIN distances d ON d."date"=dates."date" ORDER BY dates."date" ASC`;
}

function distancePoint(row: Record<string, unknown>): FleetDailyDistancePoint {
  return { date: text(row, 'date'), distanceKm: number(row, 'distanceKm') };
}

@Injectable()
export class OverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVehicle(scope: FleetScope, id: string) {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
  }

  dailyDistance(scope: FleetScope, days: number, vehicleId: string | undefined) {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const clockRows: unknown = await transaction.$queryRaw(
          vehicleDataClockSql(this.prisma.schema, scope),
        );
        const dataAsOf = rowsOf(clockRows, (row) => dateOrNull(row, 'asOf'))[0] ?? null;
        const distanceRows: unknown = await transaction.$queryRaw(
          dailyDistanceSql(this.prisma.schema, scope, days, vehicleId),
        );
        return { dataAsOf, points: rowsOf(distanceRows, distancePoint) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  overview(scope: FleetScope, now: Date): Promise<FleetOverview> {
    const { schema } = this.prisma;
    const vehicles = fleetTable(schema, 'Vehicle');
    const groups = fleetTable(schema, 'VehicleGroup');
    const events = fleetTable(schema, 'FleetEvent');
    const trips = fleetTable(schema, 'Trip');
    const facts = Prisma.sql`WITH clock AS (${vehicleDataClockSql(schema, scope)}), settings AS (${settingsSql(schema, scope)}), facts AS (
      SELECT f.*, ${vehicleActivitySql(Prisma.sql`settings."notReportingHours"`)} AS "activity"
      FROM (${vehicleFactsSql(schema, scope)}) f CROSS JOIN clock CROSS JOIN settings
    )`;
    const today = Prisma.sql`(SELECT (${now}::timestamptz AT TIME ZONE "timeZone")::date FROM settings)`;
    return this.prisma.client.$transaction(
      async (transaction) => {
        const summaryRows: unknown =
          await transaction.$queryRaw(Prisma.sql`${facts}, tasks AS (${serviceTasksWithUrgency(schema, scope, today)})
        SELECT clock."asOf" AS "dataAsOf", (${today})::text AS "businessDate",
          (SELECT count(*)::int FROM facts WHERE "status"='ACTIVE') AS "activeVehicles",
          (SELECT count(*)::int FROM facts WHERE "activity"='MOVING') AS "movingVehicles",
          (SELECT count(*)::int FROM facts WHERE "activity"='NOT_CONNECTED') AS "notReportingVehicles",
          (SELECT coalesce(sum(t."distanceKm"),0)::float8 FROM ${trips} t
            WHERE t."tenantId"=${scope.tenantId}::uuid AND t."branchId"=${scope.branchId}::uuid
              AND t."startedAt" <= clock."asOf" AND (t."startedAt" AT TIME ZONE (SELECT "timeZone" FROM settings))::date=(clock."asOf" AT TIME ZONE (SELECT "timeZone" FROM settings))::date) AS "distanceTodayKm",
          (SELECT count(*)::int FROM ${events} e WHERE e."tenantId"=${scope.tenantId}::uuid AND e."branchId"=${scope.branchId}::uuid AND e."alertStatus"::text='OPEN' AND e."severity"::text='CRITICAL') AS "openCriticalAlerts",
          (SELECT count(*)::int FROM tasks t JOIN ${vehicles} v ON v."id"=t."vehicleId" AND v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid WHERE t."status"='PLANNED' AND t."urgency"='OVERDUE' AND v."status"::text <> 'INACTIVE') AS "overdueService"
        FROM clock`);
        const summary = rowsOf(summaryRows, (row) => ({
          dataAsOf: dateOrNull(row, 'dataAsOf'),
          businessDate: text(row, 'businessDate'),
          activeVehicles: integer(row, 'activeVehicles'),
          movingVehicles: integer(row, 'movingVehicles'),
          notReportingVehicles: integer(row, 'notReportingVehicles'),
          distanceTodayKm: number(row, 'distanceTodayKm'),
          openCriticalAlerts: integer(row, 'openCriticalAlerts'),
          overdueService: integer(row, 'overdueService'),
        }))[0];
        if (!summary) {
          throw new Error('Missing Fleet overview.');
        }
        const activityRows: unknown = await transaction.$queryRaw(Prisma.sql`${facts}, buckets AS (
        SELECT g."id",g."name",g."colorToken"::text AS "colorToken" FROM ${groups} g WHERE g."tenantId"=${scope.tenantId}::uuid AND g."branchId"=${scope.branchId}::uuid
        UNION ALL SELECT NULL::uuid,NULL::text,NULL::text
      ) SELECT b."id"::text AS "groupId",b."name",b."colorToken",count(f."id")::int AS "total",
        count(*) FILTER(WHERE f."activity"='MOVING')::int AS "moving",count(*) FILTER(WHERE f."activity"='IDLE')::int AS "idle",
        count(*) FILTER(WHERE f."activity"='PARKED')::int AS "parked",count(*) FILTER(WHERE f."activity"='NOT_CONNECTED')::int AS "notReporting",
        count(*) FILTER(WHERE f."activity"='ASSET')::int AS "asset",count(*) FILTER(WHERE f."activity"='NO_DEVICE')::int AS "noDevice"
      FROM buckets b LEFT JOIN ${vehicles} v ON v."groupId" IS NOT DISTINCT FROM b."id" AND v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid AND v."status"::text <> 'INACTIVE'
      LEFT JOIN facts f ON f."id"=v."id"::text GROUP BY b."id",b."name",b."colorToken" ORDER BY b."name" ASC NULLS LAST,b."id" ASC`);
        const activityByGroup: FleetGroupActivity[] = rowsOf(activityRows, (row) => {
          const id = textOrNull(row, 'groupId');
          return {
            group:
              id === null
                ? null
                : {
                    id,
                    name: text(row, 'name'),
                    colorToken: oneOf(row, 'colorToken', Object.values(FleetGroupColor)),
                  },
            total: integer(row, 'total'),
            moving: integer(row, 'moving'),
            idle: integer(row, 'idle'),
            parked: integer(row, 'parked'),
            notReporting: integer(row, 'notReporting'),
            asset: integer(row, 'asset'),
            noDevice: integer(row, 'noDevice'),
          };
        });
        const distances: unknown = await transaction.$queryRaw(
          dailyDistanceSql(schema, scope, 14, undefined),
        );
        return { ...summary, activityByGroup, dailyDistance: rowsOf(distances, distancePoint) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
