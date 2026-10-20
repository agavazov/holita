import { fleetTable } from '../../database/sql.js';
import { FUEL_READING_MAX_AGE_HOURS, MOVING_MIN_SPEED_KPH } from '../../fleet-thresholds.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';

/** Shared latest-device and latest-any-source-odometer selection for state and Vehicles lists. */
export function vehicleFactsSql(
  schema: string,
  scope: FleetScope,
  ids?: readonly string[],
): Prisma.Sql {
  const vehicles = fleetTable(schema, 'Vehicle');
  const devices = fleetTable(schema, 'Device');
  const samples = fleetTable(schema, 'VehicleStatusSample');
  const { tenantId, branchId } = scope;
  return Prisma.sql`
    SELECT v."id"::text AS "id", v."status"::text AS "status",
      EXISTS (
        SELECT 1 FROM ${devices} d
        WHERE d."tenantId" = ${tenantId}::uuid AND d."branchId" = ${branchId}::uuid
          AND d."vehicleId" = v."id"
      ) AS "hasDevice",
      latest."recordedAt" AS "sampleRecordedAt", latest."latitude", latest."longitude",
      latest."address", latest."speedKph", latest."headingDeg"::int AS "headingDeg",
      latest."ignition", latest."fuelLevelPct", latest."externalVoltage",
      latest."backupBatteryVoltage", latest."engineHours",
      latest."coolantTempC"::int AS "coolantTempC",
      odometer."odometerKm", odometer."recordedAt" AS "odometerRecordedAt",
      odometer."source"::text AS "odometerSource"
    FROM ${vehicles} v
    LEFT JOIN LATERAL (
      SELECT s."recordedAt", s."latitude", s."longitude", s."address", s."speedKph",
        s."headingDeg", s."ignition", s."fuelLevelPct", s."externalVoltage",
        s."backupBatteryVoltage", s."engineHours", s."coolantTempC"
      FROM ${samples} s
      WHERE s."tenantId" = ${tenantId}::uuid AND s."branchId" = ${branchId}::uuid
        AND s."vehicleId" = v."id" AND s."deviceImei" IS NOT NULL
      ORDER BY s."recordedAt" DESC, s."id" DESC LIMIT 1
    ) latest ON TRUE
    LEFT JOIN LATERAL (
      SELECT s."odometerKm", s."recordedAt", s."source"
      FROM ${samples} s
      WHERE s."tenantId" = ${tenantId}::uuid AND s."branchId" = ${branchId}::uuid
        AND s."vehicleId" = v."id" AND s."odometerKm" IS NOT NULL
      ORDER BY s."recordedAt" DESC, s."id" DESC LIMIT 1
    ) odometer ON TRUE
    WHERE v."tenantId" = ${tenantId}::uuid AND v."branchId" = ${branchId}::uuid
      ${ids === undefined ? Prisma.empty : Prisma.sql`AND v."id" = ANY(${ids}::uuid[])`}`;
}

/** Latest device sample of the Branch; manual odometers never move this clock. */
export function vehicleDataClockSql(schema: string, scope: FleetScope): Prisma.Sql {
  const samples = fleetTable(schema, 'VehicleStatusSample');
  return Prisma.sql`SELECT max(s."recordedAt") AS "asOf" FROM ${samples} s
    WHERE s."tenantId" = ${scope.tenantId}::uuid AND s."branchId" = ${scope.branchId}::uuid
      AND s."deviceImei" IS NOT NULL`;
}

/** SQL counterpart of classifyActivity; the same shared thresholds and boundary comparisons. */
export function vehicleActivitySql(notReportingHours: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
  WHEN NOT f."hasDevice" THEN 'NO_DEVICE'
  WHEN f."sampleRecordedAt" IS NULL OR clock."asOf" IS NULL
    OR f."sampleRecordedAt" < clock."asOf" - (${notReportingHours})::int * INTERVAL '1 hour'
    THEN 'NOT_CONNECTED'
  WHEN f."ignition" IS NULL THEN 'ASSET'
  WHEN NOT f."ignition" THEN 'PARKED'
  WHEN f."speedKph" >= ${MOVING_MIN_SPEED_KPH}::float8 THEN 'MOVING'
  ELSE 'IDLE' END`;
}

/** SQL counterpart of fuelStatus; stale or missing fuel never enters the low-fuel count. */
export function vehicleFuelStatusSql(lowFuelPct: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
  WHEN f."sampleRecordedAt" IS NULL OR f."fuelLevelPct" IS NULL THEN 'NO_DATA'
  WHEN clock."asOf" IS NULL
    OR f."sampleRecordedAt" < clock."asOf" - ${FUEL_READING_MAX_AGE_HOURS}::int * INTERVAL '1 hour'
    THEN 'STALE'
  WHEN f."fuelLevelPct" < (${lowFuelPct})::float8 THEN 'LOW'
  ELSE 'NORMAL' END`;
}
