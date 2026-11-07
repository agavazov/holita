import { fleetTable } from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { WARNING_LAMP_PARAMETER_IDS } from './warning-lamps.js';

/** Latest observation and start of its uninterrupted decoded state, for each current pair. */
export function warningLampsSql(schema: string, scope: FleetScope, deviceIds: readonly string[]) {
  return Prisma.sql`
    SELECT d."id"::text AS "deviceId", lamp."parameterId"::int AS "parameterId",
      lamp."valueSize"::int AS "valueSize", lamp."valueHex", lamp."recordedAt", lamp."stateSince"
    FROM ${fleetTable(schema, 'device')} d
    JOIN LATERAL (
      WITH decoded AS (
        SELECT m.*, CASE
          WHEN m."valueSize" = 1 AND lower(m."valueHex") IN ('00','01','02','03','04','05','06','07')
            THEN CASE WHEN lower(m."valueHex") IN ('04','05','06') THEN '04' ELSE lower(m."valueHex") END
          ELSE NULL END AS state
        FROM ${fleetTable(schema, 'vehicleEdataMeasurement')} m
        WHERE m."tenantId" = ${scope.tenantId}::uuid AND m."branchId" = ${scope.branchId}::uuid
          AND m."vehicleId" = d."vehicleId" AND m."deviceImei" = d."imei"
          AND m."parameterId" = ANY(${[...WARNING_LAMP_PARAMETER_IDS]}::int[])
      ), boundaries AS (
        SELECT *, state IS DISTINCT FROM lag(state) OVER observations AS changed
        FROM decoded WINDOW observations AS (PARTITION BY "parameterId"
          ORDER BY "recordedAt", "receivedAt", "sourceEventId", "id")
      ), streaks AS (
        SELECT *, count(*) FILTER (WHERE changed) OVER (PARTITION BY "parameterId"
          ORDER BY "recordedAt", "receivedAt", "sourceEventId", "id" ROWS UNBOUNDED PRECEDING) AS streak
        FROM boundaries
      )
      SELECT DISTINCT ON ("parameterId") "parameterId", "valueSize", "valueHex", "recordedAt",
        min("recordedAt") OVER (PARTITION BY "parameterId", streak) AS "stateSince"
      FROM streaks ORDER BY "parameterId", "recordedAt" DESC, "receivedAt" DESC,
        "sourceEventId" DESC, "id" DESC
    ) lamp ON TRUE
    WHERE d."tenantId" = ${scope.tenantId}::uuid AND d."branchId" = ${scope.branchId}::uuid
      AND d."id" = ANY(${[...deviceIds]}::uuid[])`;
}
