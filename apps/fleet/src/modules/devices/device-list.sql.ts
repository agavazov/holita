import { containsPattern, literalContains } from '../../database/search.js';
import { fleetTable } from '../../database/sql.js';
import type { FleetDeviceSortField } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';
import type { DeviceConditionCriteria } from './device-filter.js';
import type { DeviceListCriteria, DeviceSort } from './devices.repository.js';
import { settingsSql } from '../settings/settings.sql.js';

/** Current binding/report facts and status are computed before filtering, paging or counting. */
export function deviceListRowsSql(schema: string, scope: FleetScope): Prisma.Sql {
  const devices = fleetTable(schema, 'Device');
  const vehicles = fleetTable(schema, 'Vehicle');
  const samples = fleetTable(schema, 'VehicleStatusSample');
  return Prisma.sql`
    WITH clock AS (${vehicleDataClockSql(schema, scope)}), settings AS (${settingsSql(schema, scope)})
    SELECT d."id", d."imei", d."model"::text AS "model", d."options"::text[] AS "options",
      d."firmwareVersion", d."simPhoneNumber", d."simIccid", d."vehicleId", d."installedAt", d."createdAt",
      vehicle."licensePlate" AS "vehicleLicensePlate", latest."lastReportedAt", clock."asOf",
      CASE WHEN d."vehicleId" IS NULL THEN 'IN_STOCK'
        WHEN latest."lastReportedAt" IS NOT NULL AND clock."asOf" IS NOT NULL
          AND latest."lastReportedAt" >= clock."asOf" - settings."notReportingHours"::int * INTERVAL '1 hour'
          THEN 'ONLINE' ELSE 'OFFLINE' END AS "status"
    FROM ${devices} d
    LEFT JOIN ${vehicles} vehicle ON vehicle."tenantId" = ${scope.tenantId}::uuid
      AND vehicle."branchId" = ${scope.branchId}::uuid AND vehicle."id" = d."vehicleId"
    LEFT JOIN LATERAL (
      SELECT max(s."recordedAt") AS "lastReportedAt" FROM ${samples} s
      WHERE s."tenantId" = ${scope.tenantId}::uuid AND s."branchId" = ${scope.branchId}::uuid
        AND s."vehicleId" = d."vehicleId" AND s."deviceImei" = d."imei"
    ) latest ON TRUE CROSS JOIN clock CROSS JOIN settings
    WHERE d."tenantId" = ${scope.tenantId}::uuid AND d."branchId" = ${scope.branchId}::uuid`;
}

function conditionSql(condition: DeviceConditionCriteria): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (condition.statuses) {
    clauses.push(Prisma.sql`d."status" = ANY(${condition.statuses}::text[])`);
  }
  if (condition.excludedStatuses) {
    clauses.push(Prisma.sql`d."status" <> ALL(${condition.excludedStatuses}::text[])`);
  }
  if (condition.models) {
    clauses.push(Prisma.sql`d."model" = ANY(${condition.models}::text[])`);
  }
  if (condition.excludedModels) {
    clauses.push(
      Prisma.sql`(d."model" IS NULL OR d."model" <> ALL(${condition.excludedModels}::text[]))`,
    );
  }
  if (condition.firmwareVersionEquals != null) {
    clauses.push(
      Prisma.sql`lower(d."firmwareVersion") = lower(${condition.firmwareVersionEquals}::text)`,
    );
  }
  if (condition.firmwareVersionNotEquals != null) {
    clauses.push(
      Prisma.sql`(d."firmwareVersion" IS NULL OR lower(d."firmwareVersion") <> lower(${condition.firmwareVersionNotEquals}::text))`,
    );
  }
  if (condition.firmwareVersionStartsWith != null) {
    const pattern = `${literalContains(condition.firmwareVersionStartsWith).contains}%`;
    clauses.push(Prisma.sql`d."firmwareVersion" ILIKE ${pattern}::text`);
  }
  if (condition.hasVehicle != null) {
    clauses.push(
      condition.hasVehicle
        ? Prisma.sql`d."vehicleId" IS NOT NULL`
        : Prisma.sql`d."vehicleId" IS NULL`,
    );
  }
  return clauses;
}

export function deviceListWhereSql(criteria: DeviceListCriteria): Prisma.Sql {
  const clauses = criteria.tokens.map((token) => {
    const pattern = containsPattern(token);
    return Prisma.sql`(d."imei" ILIKE ${pattern}::text OR d."firmwareVersion" ILIKE ${pattern}::text
      OR d."simPhoneNumber" ILIKE ${pattern}::text OR d."simIccid" ILIKE ${pattern}::text
      OR d."model" ILIKE ${pattern}::text OR d."vehicleLicensePlate" ILIKE ${pattern}::text)`;
  });
  if (criteria.ids) {
    clauses.push(Prisma.sql`d."id" = ANY(${criteria.ids}::uuid[])`);
  }
  if (criteria.models) {
    clauses.push(Prisma.sql`d."model" = ANY(${criteria.models}::text[])`);
  }
  if (criteria.options) {
    clauses.push(Prisma.sql`d."options" @> ${criteria.options}::text[]`);
  }
  if (criteria.vehicleIds) {
    clauses.push(Prisma.sql`d."vehicleId" = ANY(${criteria.vehicleIds}::uuid[])`);
  }
  for (const condition of criteria.allOf ?? []) {
    clauses.push(...conditionSql(condition));
  }
  return clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`;
}

export function deviceListOrderSql(sort: DeviceSort): Prisma.Sql {
  const direction = Prisma.raw(sort.direction === 'ASC' ? 'ASC' : 'DESC');
  const fields: Record<FleetDeviceSortField, Prisma.Sql> = {
    IMEI: Prisma.sql`d."imei"`,
    INSTALLED_AT: Prisma.sql`d."installedAt"`,
    CREATED_AT: Prisma.sql`d."createdAt"`,
    STATUS: Prisma.sql`CASE d."status" WHEN 'ONLINE' THEN 0 WHEN 'OFFLINE' THEN 1 WHEN 'IN_STOCK' THEN 2 END`,
    VEHICLE_LICENSE_PLATE: Prisma.sql`d."vehicleLicensePlate"`,
    LAST_REPORTED_AT: Prisma.sql`d."lastReportedAt"`,
  };
  return Prisma.sql`${fields[sort.field]} ${direction} NULLS LAST, d."id" DESC`;
}
