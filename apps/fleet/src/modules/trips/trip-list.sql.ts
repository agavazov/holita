import { containsPattern } from '../../database/search.js';
import { fleetTable } from '../../database/sql.js';
import type { FleetTripSortField } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { MANEUVER_KINDS } from '../events/events.service.js';
import type { TripConditionCriteria } from './trip-filter.js';
import type { TripCriteria, TripSort } from './trips.repository.js';

/** Same whole-second duration as the public trip field; null without an end. */
export const TRIP_DURATION_SQL = Prisma.sql`floor(extract(epoch FROM (t."endedAt" - t."startedAt")))::float8`;

export function tripListRowsSql(schema: string, scope: FleetScope): Prisma.Sql {
  const trips = fleetTable(schema, 'Trip');
  const vehicles = fleetTable(schema, 'Vehicle');
  const drivers = fleetTable(schema, 'Driver');
  return Prisma.sql`SELECT t."id", t."vehicleId", t."driverId", t."startedAt", t."endedAt",
    t."distanceKm", t."drivingScore", t."startAddress", t."endAddress",
    v."licensePlate", v."fleetNumber", d."firstName" AS "driverFirstName", d."lastName" AS "driverLastName",
    ${TRIP_DURATION_SQL} AS "durationSeconds"
    FROM ${trips} t
    JOIN ${vehicles} v ON v."id" = t."vehicleId"
      AND v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
    LEFT JOIN ${drivers} d ON d."id" = t."driverId"
      AND d."tenantId" = ${scope.tenantId}::uuid AND d."branchId" = ${scope.branchId}::uuid
    WHERE t."tenantId" = ${scope.tenantId}::uuid AND t."branchId" = ${scope.branchId}::uuid`;
}

function conditionSql(
  schema: string,
  scope: FleetScope,
  condition: TripConditionCriteria,
): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (condition.startedFrom) {
    clauses.push(Prisma.sql`t."startedAt" >= ${condition.startedFrom}::timestamptz`);
  }
  if (condition.startedTo) {
    clauses.push(Prisma.sql`t."startedAt" < ${condition.startedTo}::timestamptz`);
  }
  if (condition.vehicleIds) {
    clauses.push(Prisma.sql`t."vehicleId" = ANY(${condition.vehicleIds}::uuid[])`);
  }
  if (condition.excludedVehicleIds) {
    clauses.push(Prisma.sql`t."vehicleId" <> ALL(${condition.excludedVehicleIds}::uuid[])`);
  }
  if (condition.driverIds) {
    clauses.push(Prisma.sql`t."driverId" = ANY(${condition.driverIds}::uuid[])`);
  }
  if (condition.excludedDriverIds) {
    clauses.push(
      Prisma.sql`(t."driverId" IS NULL OR t."driverId" <> ALL(${condition.excludedDriverIds}::uuid[]))`,
    );
  }
  if (condition.hasDriver != null) {
    clauses.push(
      condition.hasDriver ? Prisma.sql`t."driverId" IS NOT NULL` : Prisma.sql`t."driverId" IS NULL`,
    );
  }
  if (condition.distanceKmAbove != null) {
    clauses.push(Prisma.sql`t."distanceKm" > ${condition.distanceKmAbove}::float8`);
  }
  if (condition.distanceKmBelow != null) {
    clauses.push(Prisma.sql`t."distanceKm" < ${condition.distanceKmBelow}::float8`);
  }
  if (condition.distanceKmFrom != null) {
    clauses.push(Prisma.sql`t."distanceKm" >= ${condition.distanceKmFrom}::float8`);
  }
  if (condition.distanceKmTo != null) {
    clauses.push(Prisma.sql`t."distanceKm" <= ${condition.distanceKmTo}::float8`);
  }
  if (condition.drivingScoreAbove != null) {
    clauses.push(Prisma.sql`t."drivingScore" > ${condition.drivingScoreAbove}::float8`);
  }
  if (condition.drivingScoreBelow != null) {
    clauses.push(Prisma.sql`t."drivingScore" < ${condition.drivingScoreBelow}::float8`);
  }
  if (condition.hasEvents != null) {
    const events = fleetTable(schema, 'FleetEvent');
    const exists = Prisma.sql`EXISTS (SELECT 1 FROM ${events} e
      WHERE e."tenantId" = ${scope.tenantId}::uuid AND e."branchId" = ${scope.branchId}::uuid
        AND e."tripId" = t."id" AND e."vehicleId" = t."vehicleId"
        AND e."kind"::text = ANY(${MANEUVER_KINDS}::text[]))`;
    clauses.push(condition.hasEvents ? exists : Prisma.sql`NOT ${exists}`);
  }
  return clauses;
}

export function tripListWhereSql(
  schema: string,
  scope: FleetScope,
  criteria: TripCriteria,
): Prisma.Sql {
  const clauses = criteria.tokens.map((token) => {
    const pattern = containsPattern(token);
    return Prisma.sql`(t."licensePlate" ILIKE ${pattern}::text OR t."fleetNumber" ILIKE ${pattern}::text
      OR t."driverFirstName" ILIKE ${pattern}::text OR t."driverLastName" ILIKE ${pattern}::text
      OR t."startAddress" ILIKE ${pattern}::text OR t."endAddress" ILIKE ${pattern}::text)`;
  });
  if (criteria.ids) {
    clauses.push(Prisma.sql`t."id" = ANY(${criteria.ids}::uuid[])`);
  }
  clauses.push(...conditionSql(schema, scope, criteria));
  if (criteria.scored != null) {
    clauses.push(
      criteria.scored
        ? Prisma.sql`t."drivingScore" IS NOT NULL`
        : Prisma.sql`t."drivingScore" IS NULL`,
    );
  }
  if (criteria.hasEnd != null) {
    clauses.push(
      criteria.hasEnd ? Prisma.sql`t."endedAt" IS NOT NULL` : Prisma.sql`t."endedAt" IS NULL`,
    );
  }
  for (const condition of criteria.allOf ?? []) {
    clauses.push(...conditionSql(schema, scope, condition));
  }
  return clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`;
}

export function tripListOrderSql(sort: TripSort): Prisma.Sql {
  const direction = Prisma.raw(sort.direction === 'ASC' ? 'ASC' : 'DESC');
  const fields: Record<FleetTripSortField, Prisma.Sql> = {
    STARTED_AT: Prisma.sql`t."startedAt"`,
    DISTANCE_KM: Prisma.sql`t."distanceKm"`,
    DRIVING_SCORE: Prisma.sql`t."drivingScore"`,
    DURATION_SECONDS: Prisma.sql`t."durationSeconds"`,
  };
  return sort.field === 'STARTED_AT'
    ? Prisma.sql`${fields[sort.field]} ${direction}, t."id" DESC`
    : Prisma.sql`${fields[sort.field]} ${direction} NULLS LAST, t."startedAt" DESC, t."id" DESC`;
}
