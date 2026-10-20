import { fleetTable } from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { defaultFleetSettings } from './settings-defaults.js';

/** Exactly one scoped settings row, including defaults, inside the caller's SQL snapshot. */
export function settingsSql(schema: string, scope: FleetScope): Prisma.Sql {
  const settings = fleetTable(schema, 'FleetSettings');
  const defaults = defaultFleetSettings();
  return Prisma.sql`SELECT coalesce(s."timeZone", ${defaults.timeZone}::text) AS "timeZone",
    coalesce(s."distanceUnit"::text, ${defaults.distanceUnit}::text) AS "distanceUnit",
    coalesce(s."volumeUnit"::text, ${defaults.volumeUnit}::text) AS "volumeUnit",
    coalesce(s."lowFuelPct", ${defaults.lowFuelPct}::int)::int AS "lowFuelPct",
    coalesce(s."notReportingHours", ${defaults.notReportingHours}::int)::int AS "notReportingHours",
    coalesce(s."speedLimitKph", ${defaults.speedLimitKph}::int)::int AS "speedLimitKph"
    FROM (SELECT 1) fallback LEFT JOIN ${settings} s
      ON s."tenantId"=${scope.tenantId}::uuid AND s."branchId"=${scope.branchId}::uuid`;
}
