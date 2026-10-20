import {
  date,
  fleetTable,
  integerOrNull,
  oneOf,
  oneOfOrNull,
  text,
  textOrNull,
} from '../../database/sql.js';
import { SERVICE_DUE_SOON_DAYS, SERVICE_DUE_SOON_KM } from '../../fleet-thresholds.js';
import type { FleetServiceUrgency } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FleetServiceStatus, FleetServiceType } from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';

/** Urgencies from worst to best; the order is also the urgency sort order. */
export const SERVICE_URGENCIES: readonly FleetServiceUrgency[] = [
  'OVERDUE',
  'DUE_SOON',
  'UNKNOWN_ODOMETER',
  'UPCOMING',
];

const SERVICE_STATUSES = Object.values(FleetServiceStatus);
const SERVICE_TYPES = Object.values(FleetServiceType);

/**
 * The single service-urgency definition: every task of the Branch with its urgency, remaining
 * days and remaining kilometres at the business date `today`, against the vehicle's latest
 * odometer of any source. Only PLANNED tasks have an urgency.
 */
export function serviceTasksWithUrgency(
  schema: string,
  scope: FleetScope,
  today: string | Prisma.Sql,
): Prisma.Sql {
  const tasks = fleetTable(schema, 'ServiceTask');
  const samples = fleetTable(schema, 'VehicleStatusSample');
  const { tenantId, branchId } = scope;
  const date = typeof today === 'string' ? Prisma.sql`${today}::date` : today;
  return Prisma.sql`
    SELECT t."id", t."vehicleId", t."serviceType"::text AS "serviceType",
      t."status"::text AS "status", t."title", t."dueOn"::text AS "dueOn", t."dueOdometerKm",
      t."completedOn"::text AS "completedOn", t."completedOdometerKm", t."workshop",
      t."replacedParts", t."costCents", t."notes", t."createdAt", t."updatedAt",
      o."odometerKm" AS "currentOdometerKm",
      CASE
        WHEN t."status"::text <> 'PLANNED' THEN NULL
        WHEN (t."dueOn" IS NOT NULL AND t."dueOn" < ${date})
          OR (t."dueOdometerKm" IS NOT NULL AND o."odometerKm" >= t."dueOdometerKm") THEN 'OVERDUE'
        WHEN (t."dueOn" IS NOT NULL AND t."dueOn" <= ${date} + ${SERVICE_DUE_SOON_DAYS}::int)
          OR (t."dueOdometerKm" IS NOT NULL
            AND t."dueOdometerKm" - o."odometerKm" <= ${SERVICE_DUE_SOON_KM}::int) THEN 'DUE_SOON'
        WHEN t."dueOdometerKm" IS NOT NULL AND o."odometerKm" IS NULL THEN 'UNKNOWN_ODOMETER'
        ELSE 'UPCOMING'
      END AS "urgency",
      CASE WHEN t."status"::text = 'PLANNED' AND t."dueOn" IS NOT NULL
        THEN (t."dueOn" - ${date})::int END AS "remainingDays",
      CASE WHEN t."status"::text = 'PLANNED' AND t."dueOdometerKm" IS NOT NULL
          AND o."odometerKm" IS NOT NULL
        THEN round(t."dueOdometerKm" - o."odometerKm")::int END AS "remainingKm"
    FROM ${tasks} t
    LEFT JOIN LATERAL (
      SELECT s."odometerKm" FROM ${samples} s
      WHERE s."tenantId" = ${tenantId}::uuid AND s."branchId" = ${branchId}::uuid
        AND s."vehicleId" = t."vehicleId" AND s."odometerKm" IS NOT NULL
      ORDER BY s."recordedAt" DESC, s."id" DESC LIMIT 1
    ) o ON t."status"::text = 'PLANNED'
    WHERE t."tenantId" = ${tenantId}::uuid AND t."branchId" = ${branchId}::uuid`;
}

/** Explicit column list of the urgency rows, read from the CTE alias `t`. */
export const SERVICE_TASK_COLUMNS = Prisma.sql`t."id", t."vehicleId", t."serviceType",
  t."status", t."title", t."dueOn", t."dueOdometerKm", t."completedOn", t."completedOdometerKm",
  t."workshop", t."replacedParts", t."costCents", t."notes", t."createdAt", t."updatedAt",
  t."urgency", t."remainingDays", t."remainingKm"`;

/** Ordering rank of `t."urgency"`: OVERDUE 1 … UPCOMING 4; NULL for tasks that are not PLANNED. */
export const URGENCY_RANK = Prisma.sql`CASE t."urgency" WHEN 'OVERDUE' THEN 1
  WHEN 'DUE_SOON' THEN 2 WHEN 'UNKNOWN_ODOMETER' THEN 3 WHEN 'UPCOMING' THEN 4 END`;

export interface ServiceTaskRow {
  id: string;
  vehicleId: string;
  serviceType: FleetServiceType;
  status: FleetServiceStatus;
  title: string | null;
  dueOn: string | null;
  dueOdometerKm: number | null;
  completedOn: string | null;
  completedOdometerKm: number | null;
  workshop: string | null;
  replacedParts: string | null;
  costCents: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  urgency: FleetServiceUrgency | null;
  remainingDays: number | null;
  remainingKm: number | null;
}

export function parseServiceTaskRow(row: Record<string, unknown>): ServiceTaskRow {
  return {
    id: text(row, 'id'),
    vehicleId: text(row, 'vehicleId'),
    serviceType: oneOf(row, 'serviceType', SERVICE_TYPES),
    status: oneOf(row, 'status', SERVICE_STATUSES),
    title: textOrNull(row, 'title'),
    dueOn: textOrNull(row, 'dueOn'),
    dueOdometerKm: integerOrNull(row, 'dueOdometerKm'),
    completedOn: textOrNull(row, 'completedOn'),
    completedOdometerKm: integerOrNull(row, 'completedOdometerKm'),
    workshop: textOrNull(row, 'workshop'),
    replacedParts: textOrNull(row, 'replacedParts'),
    costCents: integerOrNull(row, 'costCents'),
    notes: textOrNull(row, 'notes'),
    createdAt: date(row, 'createdAt'),
    updatedAt: date(row, 'updatedAt'),
    urgency: oneOfOrNull(row, 'urgency', SERVICE_URGENCIES),
    remainingDays: integerOrNull(row, 'remainingDays'),
    remainingKm: integerOrNull(row, 'remainingKm'),
  };
}
