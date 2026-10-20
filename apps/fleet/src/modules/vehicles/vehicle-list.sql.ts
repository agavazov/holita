import { containsPattern } from '../../database/search.js';
import { fleetTable } from '../../database/sql.js';
import type { FleetVehicleSortField } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import {
  vehicleDataClockSql,
  vehicleFactsSql,
  vehicleActivitySql,
  vehicleFuelStatusSql,
} from '../telemetry/vehicle-facts.sql.js';
import type { VehicleListCriteria, VehicleSort } from './vehicles.repository.js';
import type { VehicleConditionCriteria } from './vehicle-filter.js';
import { settingsSql } from '../settings/settings.sql.js';

/** The same latest facts and thresholds used by the displayed state, before filtering/paging. */
export function vehicleListRowsSql(schema: string, scope: FleetScope): Prisma.Sql {
  const vehicles = fleetTable(schema, 'Vehicle');
  const events = fleetTable(schema, 'FleetEvent');
  return Prisma.sql`
    WITH clock AS (${vehicleDataClockSql(schema, scope)}), settings AS (${settingsSql(schema, scope)}),
    facts AS (${vehicleFactsSql(schema, scope)})
    SELECT v."id", v."licensePlate", v."fleetNumber", v."vehicleType"::text AS "vehicleType",
      v."fuelType"::text AS "fuelType", v."status"::text AS "status", v."groupId",
      v."currentDriverId", v."make", v."model", v."modelYear"::int AS "modelYear", v."vin",
      v."notes", v."createdAt", v."updatedAt", f."hasDevice", f."sampleRecordedAt",
      f."latitude", f."longitude", f."address", f."speedKph", f."headingDeg", f."ignition",
      f."fuelLevelPct", f."externalVoltage", f."backupBatteryVoltage", f."engineHours",
      f."coolantTempC", f."odometerKm"::float8 AS "odometerKm", f."odometerRecordedAt",
      f."odometerSource", clock."asOf", settings."timeZone", settings."notReportingHours", settings."lowFuelPct",
      ${vehicleActivitySql(Prisma.sql`settings."notReportingHours"`)} AS "activity",
      ${vehicleFuelStatusSql(Prisma.sql`settings."lowFuelPct"`)} AS "fuelStatus",
      (SELECT count(*)::int FROM ${events} e
        WHERE e."tenantId" = ${scope.tenantId}::uuid AND e."branchId" = ${scope.branchId}::uuid
          AND e."vehicleId" = v."id" AND e."alertStatus"::text = 'OPEN') AS "openAlertCount"
    FROM ${vehicles} v JOIN facts f ON f."id" = v."id"::text CROSS JOIN clock CROSS JOIN settings
    WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid`;
}

/** Concrete Vehicles predicates; each occurrence is appended independently and joined with AND. */
function conditionSql(condition: VehicleConditionCriteria): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (condition.statuses) {
    clauses.push(Prisma.sql`v."status" = ANY(${condition.statuses}::text[])`);
  }
  if (condition.excludedStatuses) {
    clauses.push(Prisma.sql`v."status" <> ALL(${condition.excludedStatuses}::text[])`);
  }
  if (condition.activities) {
    clauses.push(Prisma.sql`v."activity" = ANY(${condition.activities}::text[])`);
  }
  if (condition.excludedActivities) {
    clauses.push(Prisma.sql`v."activity" <> ALL(${condition.excludedActivities}::text[])`);
  }
  if (condition.vehicleTypes) {
    clauses.push(Prisma.sql`v."vehicleType" = ANY(${condition.vehicleTypes}::text[])`);
  }
  if (condition.excludedVehicleTypes) {
    clauses.push(
      Prisma.sql`(v."vehicleType" IS NULL OR v."vehicleType" <> ALL(${condition.excludedVehicleTypes}::text[]))`,
    );
  }
  if (condition.fuelTypes) {
    clauses.push(Prisma.sql`v."fuelType" = ANY(${condition.fuelTypes}::text[])`);
  }
  if (condition.groupIds) {
    clauses.push(Prisma.sql`v."groupId" = ANY(${condition.groupIds}::uuid[])`);
  }
  if (condition.excludedGroupIds) {
    clauses.push(
      Prisma.sql`(v."groupId" IS NULL OR v."groupId" <> ALL(${condition.excludedGroupIds}::uuid[]))`,
    );
  }
  if (condition.hasGroup != null) {
    clauses.push(
      condition.hasGroup ? Prisma.sql`v."groupId" IS NOT NULL` : Prisma.sql`v."groupId" IS NULL`,
    );
  }
  if (condition.currentDriverIds) {
    clauses.push(Prisma.sql`v."currentDriverId" = ANY(${condition.currentDriverIds}::uuid[])`);
  }
  if (condition.hasDriver != null) {
    clauses.push(
      condition.hasDriver
        ? Prisma.sql`v."currentDriverId" IS NOT NULL`
        : Prisma.sql`v."currentDriverId" IS NULL`,
    );
  }
  if (condition.hasDevice != null) {
    clauses.push(Prisma.sql`v."hasDevice" = ${condition.hasDevice}::boolean`);
  }
  if (condition.hasOpenAlerts != null) {
    clauses.push(Prisma.sql`(v."openAlertCount" > 0) = ${condition.hasOpenAlerts}::boolean`);
  }
  if (condition.makeContains != null) {
    clauses.push(Prisma.sql`v."make" ILIKE ${containsPattern(condition.makeContains)}::text`);
  }
  if (condition.makeEquals != null) {
    clauses.push(Prisma.sql`lower(v."make") = lower(${condition.makeEquals}::text)`);
  }
  if (condition.modelYearEquals != null) {
    clauses.push(Prisma.sql`v."modelYear" = ${condition.modelYearEquals}::int`);
  }
  if (condition.modelYearAbove != null) {
    clauses.push(Prisma.sql`v."modelYear" > ${condition.modelYearAbove}::int`);
  }
  if (condition.modelYearBelow != null) {
    clauses.push(Prisma.sql`v."modelYear" < ${condition.modelYearBelow}::int`);
  }
  if (condition.modelYearFrom != null) {
    clauses.push(Prisma.sql`v."modelYear" >= ${condition.modelYearFrom}::int`);
  }
  if (condition.modelYearTo != null) {
    clauses.push(Prisma.sql`v."modelYear" <= ${condition.modelYearTo}::int`);
  }
  if (condition.odometerKmAbove != null) {
    clauses.push(Prisma.sql`v."odometerKm" > ${condition.odometerKmAbove}::float8`);
  }
  if (condition.odometerKmBelow != null) {
    clauses.push(Prisma.sql`v."odometerKm" < ${condition.odometerKmBelow}::float8`);
  }
  if (condition.odometerKmFrom != null) {
    clauses.push(Prisma.sql`v."odometerKm" >= ${condition.odometerKmFrom}::float8`);
  }
  if (condition.odometerKmTo != null) {
    clauses.push(Prisma.sql`v."odometerKm" <= ${condition.odometerKmTo}::float8`);
  }
  const createdOn = Prisma.sql`(v."createdAt" AT TIME ZONE v."timeZone")::date`;
  if (condition.createdOnAfter != null) {
    clauses.push(Prisma.sql`${createdOn} > ${condition.createdOnAfter}::date`);
  }
  if (condition.createdOnBefore != null) {
    clauses.push(Prisma.sql`${createdOn} < ${condition.createdOnBefore}::date`);
  }
  if (condition.createdOnFrom != null) {
    clauses.push(Prisma.sql`${createdOn} >= ${condition.createdOnFrom}::date`);
  }
  if (condition.createdOnTo != null) {
    clauses.push(Prisma.sql`${createdOn} <= ${condition.createdOnTo}::date`);
  }
  return clauses;
}

export function vehicleListWhereSql(
  schema: string,
  scope: FleetScope,
  criteria: VehicleListCriteria,
): Prisma.Sql {
  const drivers = fleetTable(schema, 'Driver');
  const clauses = criteria.tokens.map((token) => {
    const pattern = containsPattern(token);
    return Prisma.sql`(v."licensePlate" ILIKE ${pattern}::text OR v."fleetNumber" ILIKE ${pattern}::text
      OR v."vin" ILIKE ${pattern}::text OR v."make" ILIKE ${pattern}::text
      OR v."model" ILIKE ${pattern}::text OR v."notes" ILIKE ${pattern}::text
      OR EXISTS (SELECT 1 FROM ${drivers} d
        WHERE d."tenantId" = ${scope.tenantId}::uuid AND d."branchId" = ${scope.branchId}::uuid
          AND d."id" = v."currentDriverId"
          AND (d."firstName" ILIKE ${pattern}::text OR d."lastName" ILIKE ${pattern}::text)))`;
  });
  if (criteria.ids) {
    clauses.push(Prisma.sql`v."id" = ANY(${criteria.ids}::uuid[])`);
  }
  clauses.push(...conditionSql(criteria));
  for (const condition of criteria.allOf ?? []) {
    clauses.push(...conditionSql(condition));
  }
  return clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`;
}

export function vehicleListOrderSql(sort: VehicleSort): Prisma.Sql {
  const direction = Prisma.raw(sort.direction === 'ASC' ? 'ASC' : 'DESC');
  const fields: Record<FleetVehicleSortField, Prisma.Sql> = {
    LICENSE_PLATE: Prisma.sql`v."licensePlate"`,
    FLEET_NUMBER: Prisma.sql`v."fleetNumber"`,
    CREATED_AT: Prisma.sql`v."createdAt"`,
    UPDATED_AT: Prisma.sql`v."updatedAt"`,
    STATUS: Prisma.sql`CASE v."status" WHEN 'ACTIVE' THEN 1 WHEN 'IN_WORKSHOP' THEN 2 WHEN 'INACTIVE' THEN 3 END`,
    LAST_REPORTED_AT: Prisma.sql`v."sampleRecordedAt"`,
    ODOMETER_KM: Prisma.sql`v."odometerKm"`,
  };
  return Prisma.sql`${fields[sort.field]} ${direction} NULLS LAST, v."id" DESC`;
}
