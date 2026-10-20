import { containsPattern } from '../../database/search.js';
import { fleetTable } from '../../database/sql.js';
import type { FleetDriverSortField } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import type { DriverConditionCriteria } from './driver-filter.js';
import type { DriverListCriteria, DriverSort } from './drivers.repository.js';

function conditionSql(
  schema: string,
  scope: FleetScope,
  condition: DriverConditionCriteria,
): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (condition.statuses) {
    clauses.push(Prisma.sql`d."status"::text = ANY(${condition.statuses}::text[])`);
  }
  if (condition.excludedStatuses) {
    clauses.push(Prisma.sql`d."status"::text <> ALL(${condition.excludedStatuses}::text[])`);
  }
  if (condition.licenseCategories) {
    clauses.push(
      Prisma.sql`d."licenseCategories"::text[] && ${condition.licenseCategories}::text[]`,
    );
  }
  const vehicles = fleetTable(schema, 'Vehicle');
  const assignment = Prisma.sql`SELECT 1 FROM ${vehicles} v
    WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
      AND v."currentDriverId" = d."id"`;
  if (condition.hasVehicle != null) {
    clauses.push(
      condition.hasVehicle
        ? Prisma.sql`EXISTS (${assignment})`
        : Prisma.sql`NOT EXISTS (${assignment})`,
    );
  }
  if (condition.vehicleIds) {
    clauses.push(
      Prisma.sql`EXISTS (${assignment} AND v."id" = ANY(${condition.vehicleIds}::uuid[]))`,
    );
  }
  if (condition.excludedVehicleIds) {
    clauses.push(
      Prisma.sql`NOT EXISTS (${assignment} AND v."id" = ANY(${condition.excludedVehicleIds}::uuid[]))`,
    );
  }
  if (condition.hasScore != null) {
    clauses.push(
      condition.hasScore
        ? Prisma.sql`d."drivingScore30d" IS NOT NULL`
        : Prisma.sql`d."drivingScore30d" IS NULL`,
    );
  }
  if (condition.scoreAbove != null) {
    clauses.push(Prisma.sql`d."drivingScore30d" > ${condition.scoreAbove}::float8`);
  }
  if (condition.scoreBelow != null) {
    clauses.push(Prisma.sql`d."drivingScore30d" < ${condition.scoreBelow}::float8`);
  }
  if (condition.scoreFrom != null) {
    clauses.push(Prisma.sql`d."drivingScore30d" >= ${condition.scoreFrom}::float8`);
  }
  if (condition.scoreTo != null) {
    clauses.push(Prisma.sql`d."drivingScore30d" <= ${condition.scoreTo}::float8`);
  }
  if (condition.tripCountAbove != null) {
    clauses.push(Prisma.sql`d."tripCount30d" > ${condition.tripCountAbove}::int`);
  }
  if (condition.tripCountBelow != null) {
    clauses.push(Prisma.sql`d."tripCount30d" < ${condition.tripCountBelow}::int`);
  }
  if (condition.distanceKmAbove != null) {
    clauses.push(Prisma.sql`d."distance30dKm" > ${condition.distanceKmAbove}::float8`);
  }
  if (condition.distanceKmBelow != null) {
    clauses.push(Prisma.sql`d."distance30dKm" < ${condition.distanceKmBelow}::float8`);
  }
  if (condition.distanceKmFrom != null) {
    clauses.push(Prisma.sql`d."distance30dKm" >= ${condition.distanceKmFrom}::float8`);
  }
  if (condition.distanceKmTo != null) {
    clauses.push(Prisma.sql`d."distance30dKm" <= ${condition.distanceKmTo}::float8`);
  }
  if (condition.licenseExpiresOnAfter) {
    clauses.push(Prisma.sql`d."licenseExpiresOn" > ${condition.licenseExpiresOnAfter}::date`);
  }
  if (condition.licenseExpiresOnBefore) {
    clauses.push(Prisma.sql`d."licenseExpiresOn" < ${condition.licenseExpiresOnBefore}::date`);
  }
  if (condition.licenseExpiresOnFrom) {
    clauses.push(Prisma.sql`d."licenseExpiresOn" >= ${condition.licenseExpiresOnFrom}::date`);
  }
  if (condition.licenseExpiresOnTo) {
    clauses.push(Prisma.sql`d."licenseExpiresOn" <= ${condition.licenseExpiresOnTo}::date`);
  }
  if (condition.tachographCardExpiresOnAfter) {
    clauses.push(
      Prisma.sql`d."tachographCardExpiresOn" > ${condition.tachographCardExpiresOnAfter}::date`,
    );
  }
  if (condition.tachographCardExpiresOnBefore) {
    clauses.push(
      Prisma.sql`d."tachographCardExpiresOn" < ${condition.tachographCardExpiresOnBefore}::date`,
    );
  }
  if (condition.tachographCardExpiresOnFrom) {
    clauses.push(
      Prisma.sql`d."tachographCardExpiresOn" >= ${condition.tachographCardExpiresOnFrom}::date`,
    );
  }
  if (condition.tachographCardExpiresOnTo) {
    clauses.push(
      Prisma.sql`d."tachographCardExpiresOn" <= ${condition.tachographCardExpiresOnTo}::date`,
    );
  }
  return clauses;
}

export function driverListWhereSql(
  schema: string,
  scope: FleetScope,
  criteria: DriverListCriteria,
): Prisma.Sql {
  const clauses = criteria.tokens.map((token) => {
    const pattern = containsPattern(token);
    return Prisma.sql`(d."firstName" ILIKE ${pattern}::text OR d."lastName" ILIKE ${pattern}::text
      OR d."employeeNumber" ILIKE ${pattern}::text OR d."identificationKey" ILIKE ${pattern}::text
      OR d."phone" ILIKE ${pattern}::text)`;
  });
  if (criteria.ids) {
    clauses.push(Prisma.sql`d."id" = ANY(${criteria.ids}::uuid[])`);
  }
  clauses.push(...conditionSql(schema, scope, criteria));
  if (criteria.documentsExpireBy) {
    clauses.push(Prisma.sql`(d."licenseExpiresOn" <= ${criteria.documentsExpireBy}::date
      OR d."tachographCardExpiresOn" <= ${criteria.documentsExpireBy}::date)`);
  }
  for (const condition of criteria.allOf ?? []) {
    clauses.push(...conditionSql(schema, scope, condition));
  }
  return clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`;
}

export function driverListOrderSql(sort: DriverSort): Prisma.Sql {
  const direction = Prisma.raw(sort.direction === 'ASC' ? 'ASC' : 'DESC');
  if (sort.field === 'NAME') {
    return Prisma.sql`d."firstName" ${direction}, d."lastName" ${direction}, d."id" DESC`;
  }
  if (sort.field === 'LAST_NAME') {
    return Prisma.sql`d."lastName" ${direction}, d."firstName" ${direction}, d."id" DESC`;
  }
  const fields: Record<Exclude<FleetDriverSortField, 'NAME' | 'LAST_NAME'>, Prisma.Sql> = {
    EMPLOYEE_NUMBER: Prisma.sql`d."employeeNumber"`,
    LICENSE_EXPIRES_ON: Prisma.sql`d."licenseExpiresOn"`,
    TACHOGRAPH_CARD_EXPIRES_ON: Prisma.sql`d."tachographCardExpiresOn"`,
    CREATED_AT: Prisma.sql`d."createdAt"`,
    STATUS: Prisma.sql`CASE d."status" WHEN 'ACTIVE' THEN 0 WHEN 'ON_LEAVE' THEN 1 ELSE 2 END`,
    DRIVING_SCORE_30D: Prisma.sql`d."drivingScore30d"`,
    TRIP_COUNT_30D: Prisma.sql`d."tripCount30d"`,
    DISTANCE_30D_KM: Prisma.sql`d."distance30dKm"`,
  };
  return Prisma.sql`${fields[sort.field]} ${direction} NULLS LAST, d."id" DESC`;
}
