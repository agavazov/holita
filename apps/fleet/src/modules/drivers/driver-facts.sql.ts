import type { DataWindow } from '../../clock/fleet-clock.js';
import { fleetTable } from '../../database/sql.js';
import { DRIVER_STATS_DAYS, SCORE_MIN_DISTANCE_KM } from '../../fleet-thresholds.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';

/** The list's 30-day trip facts; score follows the existing distance-weighted scorecard formula. */
export function driverFactsSql(
  schema: string,
  scope: FleetScope,
  window?: DataWindow | null,
  driverIds?: readonly string[],
): Prisma.Sql {
  const drivers = fleetTable(schema, 'Driver');
  const trips = fleetTable(schema, 'Trip');
  const clock =
    window === undefined
      ? vehicleDataClockSql(schema, scope)
      : Prisma.sql`SELECT ${window?.end ?? null}::timestamptz AS "asOf"`;
  const start =
    window === undefined
      ? Prisma.sql`clock."asOf" - ${DRIVER_STATS_DAYS * 24}::int * INTERVAL '1 hour'`
      : Prisma.sql`${window?.start ?? null}::timestamptz`;
  const requestedDrivers =
    driverIds === undefined
      ? Prisma.empty
      : Prisma.sql`AND t."driverId" = ANY(${driverIds}::uuid[])`;
  return Prisma.sql`WITH clock AS (${clock}), trip_stats AS (
    SELECT t."driverId", count(*)::int AS "tripCount30d",
      coalesce(sum(t."distanceKm"), 0)::float8 AS "distance30dKm",
      (sum(t."drivingScore" * t."distanceKm") FILTER (
          WHERE t."drivingScore" IS NOT NULL AND t."distanceKm" >= ${SCORE_MIN_DISTANCE_KM}::float8)
        / nullif(sum(t."distanceKm") FILTER (
          WHERE t."drivingScore" IS NOT NULL AND t."distanceKm" >= ${SCORE_MIN_DISTANCE_KM}::float8), 0)
      )::float8 AS "drivingScore30d"
    FROM ${trips} t CROSS JOIN clock
    WHERE t."tenantId" = ${scope.tenantId}::uuid AND t."branchId" = ${scope.branchId}::uuid
      AND t."driverId" IS NOT NULL AND t."startedAt" > ${start} AND t."startedAt" <= clock."asOf"
      ${requestedDrivers}
    GROUP BY t."driverId"
  )
  SELECT d."id", d."firstName", d."lastName", d."employeeNumber", d."identificationKey", d."phone",
    d."status", d."licenseCategories", d."licenseExpiresOn", d."tachographCardExpiresOn", d."createdAt",
    clock."asOf", coalesce(s."tripCount30d", 0)::int AS "tripCount30d",
    coalesce(s."distance30dKm", 0)::float8 AS "distance30dKm", s."drivingScore30d"
  FROM ${drivers} d CROSS JOIN clock LEFT JOIN trip_stats s ON s."driverId" = d."id"
  WHERE d."tenantId" = ${scope.tenantId}::uuid AND d."branchId" = ${scope.branchId}::uuid`;
}
