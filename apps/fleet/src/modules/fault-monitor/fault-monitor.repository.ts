import { Injectable } from '@nestjs/common';
import { fleetEventKindDb } from '../../database/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  date,
  dateOrNull,
  fleetTable,
  integer,
  integerOrNull,
  numberOrNull,
  oneOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import type { FleetFaultLogKind } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';

export type StoredFaultLogKind = Exclude<FleetFaultLogKind, 'FAULT_READ'>;

export const STORED_FAULT_LOG_KINDS: readonly StoredFaultLogKind[] = [
  'FAULT_ADDED',
  'FAULT_REMOVED',
  'CAN_LOST',
  'CAN_RESTORED',
  'LAMP_ON',
  'LAMP_OFF',
  'FREEZE_FRAME',
];

export interface FaultLogQuery {
  vehicleIds: readonly string[] | undefined;
  kinds: readonly StoredFaultLogKind[];
  from: Date;
  to: Date;
  offset: number;
  limit: number;
}

const VEHICLE_REF = {
  id: true,
  licensePlate: true,
  fleetNumber: true,
  vehicleType: true,
  status: true,
} as const;

@Injectable()
export class FaultMonitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Vehicles with a Device and their newest CAN data and CAN loss, by license plate. */
  async vehicles(scope: FleetScope) {
    const vehicles = await this.prisma.client.vehicle.findMany({
      where: { ...scope, devices: { some: {} } },
      select: VEHICLE_REF,
      orderBy: [{ licensePlate: 'asc' }, { id: 'asc' }],
    });
    if (!vehicles.length) {
      return [];
    }
    const schema = this.prisma.schema;
    const can = rowsOf(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT v."id"::text AS "vehicleId", data."recordedAt" AS "canDataAt",
          lost."occurredAt" AS "canLostAt"
        FROM ${fleetTable(schema, 'vehicle')} v
        LEFT JOIN LATERAL (
          SELECT m."recordedAt" FROM ${fleetTable(schema, 'vehicleEdataMeasurement')} m
          WHERE m."tenantId" = ${scope.tenantId}::uuid AND m."branchId" = ${scope.branchId}::uuid
            AND m."vehicleId" = v."id" AND NOT m."freezeFrame"
          ORDER BY m."recordedAt" DESC LIMIT 1
        ) data ON TRUE
        LEFT JOIN LATERAL (
          SELECT e."occurredAt" FROM ${fleetTable(schema, 'fleetEvent')} e
          WHERE e."tenantId" = ${scope.tenantId}::uuid AND e."branchId" = ${scope.branchId}::uuid
            AND e."vehicleId" = v."id" AND e."kind"::text = ${fleetEventKindDb.CAN_DISCONNECTED}::text
          ORDER BY e."occurredAt" DESC LIMIT 1
        ) lost ON TRUE
        WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
          AND v."id" = ANY(${vehicles.map((vehicle) => vehicle.id)}::uuid[])`),
      (row) => ({
        vehicleId: text(row, 'vehicleId'),
        canDataAt: dateOrNull(row, 'canDataAt'),
        canLostAt: dateOrNull(row, 'canLostAt'),
      }),
    );
    return vehicles.map((vehicle) => {
      const facts = can.find((row) => row.vehicleId === vehicle.id);
      return {
        vehicle,
        canDataAt: facts?.canDataAt ?? null,
        canLostAt: facts?.canLostAt ?? null,
      };
    });
  }

  /**
   * One page of the stored fault log, newest first, with the total. Fault codes keep only a change
   * of logger status, so the 419 snapshot that answers every fault read does not repeat an active
   * code. A CAN loss is the first 417 after CAN data, and its restoration the first 405 after the
   * loss's last 417.
   */
  async log(scope: FleetScope, query: FaultLogQuery) {
    const schema = this.prisma.schema;
    const events = fleetTable(schema, 'fleetEvent');
    const measurements = fleetTable(schema, 'vehicleEdataMeasurement');
    const notifications = fleetTable(schema, 'fleetNotification');
    const scoped = (alias: string) =>
      Prisma.sql`${Prisma.raw(alias)}."tenantId" = ${scope.tenantId}::uuid AND ${Prisma.raw(alias)}."branchId" = ${scope.branchId}::uuid`;
    const vehicles = (alias: string) =>
      query.vehicleIds
        ? Prisma.sql`AND ${Prisma.raw(alias)}."vehicleId" = ANY(${[...query.vehicleIds]}::uuid[])`
        : Prisma.empty;
    const { from, to } = query;
    const rows = rowsOf(
      await this.prisma.client.$queryRaw(Prisma.sql`
        WITH codes AS (
          SELECT c.*, lag(c."status") OVER (
            PARTITION BY c."vehicleId", c."deviceImei", c."report", c."troubleCode"
            ORDER BY c."occurredAt", c."diagnosticIndex", c."id") AS "previous"
          FROM (
            SELECT f."id", f."vehicleId", f."deviceImei", f."occurredAt", f."troubleCode",
              f."diagnosticSpn", f."diagnosticFmi", f."diagnosticIndex",
              coalesce(f."diagnosticReport", 419) AS "report",
              CASE WHEN f."diagnosticStatus" IN (1, 2) THEN f."diagnosticStatus"::int
                WHEN f."details" LIKE 'eData 419:%'
                  THEN CASE WHEN f."details" LIKE '%logger deleted%' THEN 2 ELSE 1 END
              END AS "status"
            FROM ${events} f
            WHERE ${scoped('f')} AND f."kind"::text = ${fleetEventKindDb.DIAGNOSTIC_TROUBLE_CODE}::text
              AND f."occurredAt" < ${to}::timestamptz ${vehicles('f')}
          ) c
          WHERE c."status" IS NOT NULL
        ), losses AS (
          SELECT f."id", f."vehicleId", f."deviceImei", f."occurredAt",
            lag(f."occurredAt") OVER vehicle_losses AS "previous",
            lead(f."occurredAt") OVER vehicle_losses AS "next"
          FROM ${events} f
          WHERE ${scoped('f')} AND f."kind"::text = ${fleetEventKindDb.CAN_DISCONNECTED}::text
            AND f."occurredAt" < ${to}::timestamptz ${vehicles('f')}
          WINDOW vehicle_losses AS (PARTITION BY f."vehicleId" ORDER BY f."occurredAt", f."id")
        ), entries AS (
          SELECT CASE c."status" WHEN 1 THEN 'FAULT_ADDED' ELSE 'FAULT_REMOVED' END AS "kind",
            'event:' || c."id"::text AS "id", c."vehicleId", c."deviceImei", c."occurredAt",
            c."troubleCode", c."diagnosticSpn"::float8 AS "spn", c."diagnosticFmi"::int AS "fmi",
            NULL::text AS "lamp", NULL::text AS "lampState", NULL::int AS "valueCount"
          FROM codes c
          WHERE c."status" IS DISTINCT FROM c."previous" AND c."occurredAt" >= ${from}::timestamptz
          UNION ALL
          SELECT 'CAN_LOST', 'event:' || l."id"::text, l."vehicleId", l."deviceImei",
            l."occurredAt", NULL, NULL, NULL, NULL, NULL, NULL
          FROM losses l
          WHERE l."occurredAt" >= ${from}::timestamptz AND (l."previous" IS NULL OR EXISTS (
            SELECT 1 FROM ${measurements} m
            WHERE ${scoped('m')} AND m."vehicleId" = l."vehicleId" AND NOT m."freezeFrame"
              AND m."recordedAt" > l."previous" AND m."recordedAt" < l."occurredAt"))
          UNION ALL
          SELECT 'CAN_RESTORED', 'restored:' || l."id"::text, l."vehicleId", restored."deviceImei",
            restored."recordedAt", NULL, NULL, NULL, NULL, NULL, NULL
          FROM losses l
          CROSS JOIN LATERAL (
            SELECT m."recordedAt", m."deviceImei" FROM ${measurements} m
            WHERE ${scoped('m')} AND m."vehicleId" = l."vehicleId" AND NOT m."freezeFrame"
              AND m."recordedAt" > l."occurredAt"
            ORDER BY m."recordedAt" LIMIT 1
          ) restored
          WHERE (l."next" IS NULL OR restored."recordedAt" < l."next")
            AND restored."recordedAt" >= ${from}::timestamptz AND restored."recordedAt" < ${to}::timestamptz
          UNION ALL
          SELECT CASE n."wordingKey" WHEN 'notification.warningLampEntered' THEN 'LAMP_ON'
              ELSE 'LAMP_OFF' END,
            'notification:' || n."id"::text, n."vehicleId", NULL, n."occurredAt", NULL, NULL, NULL,
            n."parameters" ->> 'lamp', n."parameters" ->> 'state', NULL
          FROM ${notifications} n
          WHERE ${scoped('n')} AND n."vehicleId" IS NOT NULL
            AND n."wordingKey" IN ('notification.warningLampEntered', 'notification.warningLampOff')
            AND n."occurredAt" >= ${from}::timestamptz AND n."occurredAt" < ${to}::timestamptz ${vehicles('n')}
          UNION ALL
          SELECT 'FREEZE_FRAME', 'frame:' || m."deviceImei" || ':' || m."sourceEventId"::text,
            m."vehicleId", m."deviceImei", m."recordedAt", NULL, NULL, NULL, NULL, NULL,
            count(*)::int
          FROM ${measurements} m
          WHERE ${scoped('m')} AND m."freezeFrame" AND m."recordedAt" >= ${from}::timestamptz
            AND m."recordedAt" < ${to}::timestamptz ${vehicles('m')}
          GROUP BY m."vehicleId", m."deviceImei", m."sourceEventId", m."recordedAt"
        ), filtered AS (
          SELECT * FROM entries WHERE "kind" = ANY(${[...query.kinds]}::text[])
        )
        SELECT total."count" AS "total", page.*
        FROM (SELECT count(*)::int AS "count" FROM filtered) total
        LEFT JOIN LATERAL (
          SELECT f."kind", f."id", f."vehicleId"::text AS "vehicleId", f."deviceImei",
            f."occurredAt", f."troubleCode", f."spn", f."fmi", f."lamp", f."lampState",
            f."valueCount"
          FROM filtered f ORDER BY f."occurredAt" DESC, f."id" COLLATE "C" DESC
          OFFSET ${query.offset}::int LIMIT ${query.limit}::int
        ) page ON TRUE`),
      (row) => ({
        total: integer(row, 'total'),
        entry:
          row['id'] === null
            ? null
            : {
                id: text(row, 'id'),
                kind: oneOf(row, 'kind', STORED_FAULT_LOG_KINDS),
                occurredAt: date(row, 'occurredAt'),
                vehicleId: text(row, 'vehicleId'),
                deviceImei: textOrNull(row, 'deviceImei'),
                troubleCode: textOrNull(row, 'troubleCode'),
                spn: numberOrNull(row, 'spn'),
                fmi: integerOrNull(row, 'fmi'),
                lamp: textOrNull(row, 'lamp'),
                lampState: textOrNull(row, 'lampState'),
                valueCount: integerOrNull(row, 'valueCount'),
              },
      }),
    );
    return {
      total: rows[0]?.total ?? 0,
      entries: rows.flatMap((row) => (row.entry ? [row.entry] : [])),
    };
  }

  vehicleRefs(scope: FleetScope, ids: readonly string[]) {
    return this.prisma.client.vehicle.findMany({
      where: { ...scope, id: { in: [...ids] } },
      select: VEHICLE_REF,
    });
  }

  /** Devices of the Branch, or of the given vehicles, with their current vehicle. */
  devices(scope: FleetScope, vehicleIds: readonly string[] | undefined) {
    return this.prisma.client.device.findMany({
      where: { ...scope, ...(vehicleIds ? { vehicleId: { in: [...vehicleIds] } } : {}) },
      select: { id: true, imei: true, vehicleId: true },
    });
  }
}
