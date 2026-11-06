import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  sqlRows,
  sqlText,
  sqlNullableText,
  sqlNullableDate,
  sqlInteger,
} from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  ErmDataGap,
  ErmEventCategory,
  ErmNetworkChange,
  ErmEventSeverity,
  ErmFleetProblemSourceKind,
  ErmFleetProblemState,
} from '../../generated/graphql/types.js';
import { parseFrame } from '../../starlink/protocol.js';
import { categoryEventIds, starlinkEvents } from '../../starlink/event-catalog.js';
import type { TelemetryQuery } from './telemetry-query.js';

function nullableNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || (typeof value === 'number' && Number.isFinite(value))) {
    return value;
  }
  throw new Error(`Invalid ERM database number: ${key}`);
}

function nullableBoolean(row: Record<string, unknown>, key: string): boolean | null {
  const value = row[key];
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  throw new Error(`Invalid ERM database boolean: ${key}`);
}

function reportingInterval(
  ignitionOn: boolean | null,
  engineOn: boolean | null,
  speedKmh: number | null,
): number {
  return (ignitionOn ?? engineOn) === true || (speedKmh ?? 0) > 0 ? 300 : 3600;
}

function problemSourceKind(row: Record<string, unknown>): ErmFleetProblemSourceKind {
  const value = row['sourceKind'];
  if (value === 'DIAGNOSTIC' || value === 'ALARM' || value === 'COMMAND') {
    return value;
  }
  throw new Error('Invalid ERM problem source kind');
}

function problemSeverity(row: Record<string, unknown>): ErmEventSeverity {
  const value = row['severity'];
  if (value === 'INFO' || value === 'WARNING' || value === 'CRITICAL') {
    return value;
  }
  throw new Error('Invalid ERM problem severity');
}

function problemState(row: Record<string, unknown>): ErmFleetProblemState {
  const value = row['state'];
  if (value === 'RECORDED' || value === 'FAILED' || value === 'UNCERTAIN' || value === 'EXPIRED') {
    return value;
  }
  throw new Error('Invalid ERM problem state');
}

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private table(
    name:
      | 'ermConnection'
      | 'ermFrame'
      | 'ermEvent'
      | 'ermCommand'
      | 'ermUpstreamClose'
      | 'ermCommandRequest',
  ) {
    return Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async fleetUnitStates(unitIds: string[], snapshot: Date) {
    return sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT u."unitId", frame."receivedAt" AS "lastFrameAt",
          ignition.value AS "ignitionOn", engine.value AS "engineOn", speed.value AS "speedKmh"
        FROM jsonb_array_elements_text(${JSON.stringify(unitIds)}::jsonb) u("unitId")
        LEFT JOIN LATERAL (
          SELECT "receivedAt" FROM ${this.table('ermFrame')}
          WHERE "unitId" = u."unitId" AND direction = 'device' AND NOT partial
            AND "receivedAt" <= ${snapshot}
          ORDER BY "receivedAt" DESC, id DESC LIMIT 1
        ) frame ON true
        LEFT JOIN LATERAL (
          SELECT (event.fields ->> '#IGN#' = '1') AS value
          FROM ${this.table('ermEvent')} event
          JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
          WHERE event."unitId" = u."unitId" AND frame."receivedAt" <= ${snapshot}
            AND event.fields ->> '#IGN#' IN ('0', '1')
          ORDER BY frame."receivedAt" DESC, event.id DESC LIMIT 1
        ) ignition ON true
        LEFT JOIN LATERAL (
          SELECT event."engineOn" AS value FROM ${this.table('ermEvent')} event
          JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
          WHERE event."unitId" = u."unitId" AND frame."receivedAt" <= ${snapshot}
            AND event."engineOn" IS NOT NULL
          ORDER BY frame."receivedAt" DESC, event.id DESC LIMIT 1
        ) engine ON true
        LEFT JOIN LATERAL (
          SELECT event."speedKmh" AS value FROM ${this.table('ermEvent')} event
          JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
          WHERE event."unitId" = u."unitId" AND frame."receivedAt" <= ${snapshot}
            AND event."speedKmh" IS NOT NULL
          ORDER BY frame."receivedAt" DESC, event.id DESC LIMIT 1
        ) speed ON true
      `),
    ).map((row) => ({
      unitId: sqlText(row, 'unitId'),
      lastFrameAt: sqlNullableDate(row, 'lastFrameAt'),
      expectedIntervalSeconds: reportingInterval(
        nullableBoolean(row, 'ignitionOn'),
        nullableBoolean(row, 'engineOn'),
        nullableNumber(row, 'speedKmh'),
      ),
    }));
  }

  async fleetProblems(
    unitIds: string[],
    tenantId: string,
    branchId: string,
    from: Date,
    to: Date,
    snapshot: Date,
    offset: number,
    limit: number,
  ) {
    const alarms = categoryEventIds(['ALARM']);
    const critical = [...starlinkEvents]
      .filter(([, event]) => event.severity === 'CRITICAL')
      .map(([id]) => id);
    const warning = [...starlinkEvents]
      .filter(([, event]) => event.severity === 'WARNING')
      .map(([id]) => id);
    const evidence = Prisma.sql`
      WITH units AS (
        SELECT jsonb_array_elements_text(${JSON.stringify(unitIds)}::jsonb) AS "unitId"
      ), evidence AS (
        SELECT CASE WHEN event."eventId" IN ('02', '70', '89')
          OR event.fields -> 'edata' ->> 'type' IN ('411', '419')
          THEN 'DIAGNOSTIC' ELSE 'ALARM' END AS "sourceKind",
          event.id::text AS "sourceId", event."unitId" AS imei, NULL::text AS "deviceId",
          coalesce(event."eventTime", frame."receivedAt") AS "occurredAt",
          CASE WHEN event."eventId" IN (${Prisma.join(critical)}) THEN 'CRITICAL'
            WHEN event."eventId" IN (${Prisma.join(warning)}) THEN 'WARNING'
            WHEN event.fields -> 'edata' ->> 'type' = '411'
              AND event.fields -> 'edata' ->> 'canError' <> '0' THEN 'WARNING'
            WHEN event.fields -> 'edata' ->> 'type' = '419'
              AND event.fields -> 'edata' -> 'faults' @> '[{"status":1}]'::jsonb THEN 'WARNING'
            ELSE 'INFO' END AS severity,
          'RECORDED' AS state, coalesce(event."eventId", 'UNKNOWN') AS code,
          NULL::text AS details, event."eventTime", event."eventId", event.fields
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" IN (SELECT "unitId" FROM units)
          AND (event."eventId" IN (${Prisma.join(alarms)}, '70', '89')
            OR event.fields -> 'edata' ->> 'type' IN ('411', '419'))
          AND coalesce(event."eventTime", frame."receivedAt") >= ${from}
          AND coalesce(event."eventTime", frame."receivedAt") < ${to}
          AND frame."receivedAt" <= ${snapshot}
        UNION ALL
        SELECT 'COMMAND', request.id::text, request."unitId", request."deviceId"::text,
          coalesce(request."completedAt", request."createdAt"), 'WARNING',
          upper(request.status::text), request.action::text, request."failureReason",
          NULL::timestamptz, NULL::text, NULL::jsonb
        FROM ${this.table('ermCommandRequest')} request
        WHERE request."tenantId" = ${tenantId}::uuid AND request."branchId" = ${branchId}::uuid
          AND request."unitId" IN (SELECT "unitId" FROM units)
          AND request.status IN ('failed', 'uncertain', 'expired')
          AND coalesce(request."completedAt", request."createdAt") >= ${from}
          AND coalesce(request."completedAt", request."createdAt") < ${to}
          AND coalesce(request."completedAt", request."createdAt") <= ${snapshot}
      )`;
    const [selected, grouped] = await this.prisma.client.$transaction(
      [
        this.prisma.client.$queryRaw(Prisma.sql`${evidence}
        SELECT * FROM evidence ORDER BY "occurredAt" DESC, "sourceKind", "sourceId"
        LIMIT ${limit} OFFSET ${offset}`),
        this.prisma.client.$queryRaw(Prisma.sql`${evidence}
        SELECT "sourceKind", severity, count(*)::integer AS count FROM evidence
        GROUP BY "sourceKind", severity ORDER BY "sourceKind", severity`),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: sqlRows(selected).map((row) => {
        const occurredAt = sqlNullableDate(row, 'occurredAt');
        if (occurredAt === null) {
          throw new Error('Invalid ERM problem timestamp');
        }
        return {
          sourceKind: problemSourceKind(row),
          sourceId: sqlText(row, 'sourceId'),
          imei: sqlText(row, 'imei'),
          deviceId: sqlNullableText(row, 'deviceId'),
          occurredAt,
          severity: problemSeverity(row),
          state: problemState(row),
          code: sqlText(row, 'code'),
          details: sqlNullableText(row, 'details'),
          eventTime: sqlNullableDate(row, 'eventTime'),
          eventId: sqlNullableText(row, 'eventId'),
          fields: row['fields'],
        };
      }),
      counts: sqlRows(grouped).map((row) => ({
        sourceKind: problemSourceKind(row),
        severity: problemSeverity(row),
        count: sqlInteger(row, 'count'),
      })),
    };
  }

  async internalEvents(imei: string, after: string, limit: number, receivedBefore: Date) {
    return sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT event.id::text AS id, event."eventId", event."eventTime", frame."receivedAt",
          event.latitude::double precision AS latitude, event.longitude::double precision AS longitude,
          event."speedKmh", event.heading, event.odometer AS "odometerKm", event."engineOn",
          event."mainVoltage", event."backupVoltage", event.fields -> 'edata' AS edata,
          event.fields ->> '#IGN#' AS ignition
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = ${imei} AND event.id > ${after}::bigint
          AND frame."receivedAt" <= ${receivedBefore}
        ORDER BY event.id ASC
        LIMIT ${limit}
      `),
    ).map((row) => {
      const receivedAt = sqlNullableDate(row, 'receivedAt');
      const engineOn = row['engineOn'];
      if (receivedAt === null || (engineOn !== null && typeof engineOn !== 'boolean')) {
        throw new Error('Invalid ERM telemetry database row');
      }
      return {
        id: sqlText(row, 'id'),
        eventId: sqlNullableText(row, 'eventId'),
        eventTime: sqlNullableDate(row, 'eventTime'),
        receivedAt,
        latitude: nullableNumber(row, 'latitude'),
        longitude: nullableNumber(row, 'longitude'),
        speedKmh: nullableNumber(row, 'speedKmh'),
        heading: nullableNumber(row, 'heading'),
        odometerKm: nullableNumber(row, 'odometerKm'),
        engineOn,
        mainVoltage: nullableNumber(row, 'mainVoltage'),
        backupVoltage: nullableNumber(row, 'backupVoltage'),
        edata: row['edata'] ?? null,
        ignitionOn: row['ignition'] === '1' ? true : row['ignition'] === '0' ? false : null,
      };
    });
  }

  async deviceStates(unitIds: string[], snapshot: Date) {
    const alarms = categoryEventIds(['ALARM']);
    const since = new Date(snapshot.getTime() - 24 * 60 * 60 * 1000);
    const rows = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT u."unitId", c.id::text AS "connectionId", f."receivedAt" AS "lastFrameAt",
        e.id::text AS "latestEventId", p.id::text AS "lastPositionId", a.id::text AS "latestAlarmId",
        n.count AS "alarmsLast24h", mv.id::text AS "mainVoltageEventId",
        bv.id::text AS "backupVoltageEventId", sq.id::text AS "signalQualityEventId",
        fw.id::text AS "firmwareCommandId", closed."closeReason" AS "lastCloseReason",
        closed."closedAt" AS "lastClosedAt", uc.count AS "upstreamClosesLast24h",
        known_ignition.value AS "initialIgnitionOn", known_engine.value AS "initialEngineOn",
        known_speed.value AS "initialSpeedKmh",
        known_network.value AS "initialNetworkType", known_operator.value AS "initialOperatorCode"
      FROM jsonb_array_elements_text(${JSON.stringify(unitIds)}::jsonb) u("unitId")
      LEFT JOIN LATERAL (
        SELECT id FROM ${this.table('ermConnection')}
        WHERE "unitId" = u."unitId" AND "openedAt" <= ${snapshot}
        ORDER BY "openedAt" DESC, id DESC LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT "receivedAt" FROM ${this.table('ermFrame')}
        WHERE "unitId" = u."unitId" AND direction = 'device' AND NOT partial AND "receivedAt" <= ${snapshot}
        ORDER BY "receivedAt" DESC, id DESC LIMIT 1
      ) f ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame."receivedAt" <= ${snapshot}
        ORDER BY coalesce(event."eventTime", frame."receivedAt") DESC, event.id DESC LIMIT 1
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND event.latitude IS NOT NULL AND event.longitude IS NOT NULL
          AND frame."receivedAt" <= ${snapshot}
        ORDER BY event."eventTime" DESC NULLS LAST, event.id DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND event."eventId" IN (${Prisma.join(alarms)})
          AND frame."receivedAt" <= ${snapshot}
        ORDER BY event."eventTime" DESC NULLS LAST, event.id DESC LIMIT 1
      ) a ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS count FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND event."eventId" IN (${Prisma.join(alarms)})
          AND coalesce(event."eventTime", frame."receivedAt") >= ${since}
          AND coalesce(event."eventTime", frame."receivedAt") <= ${snapshot}
          AND frame."receivedAt" <= ${snapshot}
      ) n ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND event."mainVoltage" IS NOT NULL
          AND frame."receivedAt" <= ${snapshot}
        ORDER BY coalesce(event."eventTime", frame."receivedAt") DESC, event.id DESC LIMIT 1
      ) mv ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND event."backupVoltage" IS NOT NULL
          AND frame."receivedAt" <= ${snapshot}
        ORDER BY coalesce(event."eventTime", frame."receivedAt") DESC, event.id DESC LIMIT 1
      ) bv ON true
      LEFT JOIN LATERAL (
        SELECT event.id FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame."receivedAt" <= ${snapshot}
          AND (jsonb_typeof(event.fields -> '#CSS#') = 'number'
            OR event.fields ->> '#CSS#' ~ '^[+-]?[0-9]+([.][0-9]+)?$')
        ORDER BY coalesce(event."eventTime", frame."receivedAt") DESC, event.id DESC LIMIT 1
      ) sq ON true
      LEFT JOIN LATERAL (
        SELECT id FROM ${this.table('ermCommand')}
        WHERE "unitId" = u."unitId" AND status = 'answered' AND command = '48'
          AND "answeredAt" <= ${snapshot} AND convert_from(response, 'LATIN1') ~ '(^|[,;])VER='
        ORDER BY "answeredAt" DESC, id DESC LIMIT 1
      ) fw ON true
      LEFT JOIN LATERAL (
        SELECT "closeReason", "closedAt" FROM ${this.table('ermConnection')}
        WHERE "unitId" = u."unitId" AND "closedAt" <= ${snapshot}
        ORDER BY "closedAt" DESC, id DESC LIMIT 1
      ) closed ON true
      LEFT JOIN LATERAL (
        SELECT (
          (SELECT count(*) FROM ${this.table('ermUpstreamClose')} upstream
            JOIN ${this.table('ermConnection')} connection ON connection.id = upstream."connectionId"
            WHERE connection."unitId" = u."unitId" AND upstream."closedAt" >= ${since}
              AND upstream."closedAt" <= ${snapshot})
          + (SELECT count(*) FROM ${this.table('ermConnection')}
            WHERE "unitId" = u."unitId" AND "closedAt" >= ${since} AND "closedAt" <= ${snapshot}
              AND "closeReason" LIKE 'upstream%')
        )::integer AS count
      ) uc ON true
      LEFT JOIN LATERAL (
        SELECT event."engineOn" AS value
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame.direction = 'device' AND NOT frame.partial
          AND frame."receivedAt" < ${since} AND event."engineOn" IS NOT NULL
        ORDER BY frame."receivedAt" DESC, frame.id DESC, event.id DESC LIMIT 1
      ) known_engine ON true
      LEFT JOIN LATERAL (
        SELECT event.fields ->> '#IGN#' = '1' AS value
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame.direction = 'device' AND NOT frame.partial
          AND frame."receivedAt" < ${since} AND event.fields ->> '#IGN#' IN ('0', '1')
        ORDER BY frame."receivedAt" DESC, frame.id DESC, event.id DESC LIMIT 1
      ) known_ignition ON true
      LEFT JOIN LATERAL (
        SELECT event."speedKmh" AS value
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame.direction = 'device' AND NOT frame.partial
          AND frame."receivedAt" < ${since} AND event."speedKmh" IS NOT NULL
        ORDER BY frame."receivedAt" DESC, frame.id DESC, event.id DESC LIMIT 1
      ) known_speed ON true
      LEFT JOIN LATERAL (
        SELECT nullif(event.fields ->> '#NT#', '') AS value
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame.direction = 'device' AND NOT frame.partial
          AND frame."receivedAt" < ${since} AND nullif(event.fields ->> '#NT#', '') IS NOT NULL
        ORDER BY frame."receivedAt" DESC, frame.id DESC, event.id DESC LIMIT 1
      ) known_network ON true
      LEFT JOIN LATERAL (
        SELECT nullif(event.fields ->> '#NC#', '') AS value
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = u."unitId" AND frame.direction = 'device' AND NOT frame.partial
          AND frame."receivedAt" < ${since} AND nullif(event.fields ->> '#NC#', '') IS NOT NULL
        ORDER BY frame."receivedAt" DESC, frame.id DESC, event.id DESC LIMIT 1
      ) known_operator ON true
    `),
    ).map((row) => ({
      unitId: sqlText(row, 'unitId'),
      connectionId: sqlNullableText(row, 'connectionId'),
      lastFrameAt: sqlNullableDate(row, 'lastFrameAt'),
      latestEventId: sqlNullableText(row, 'latestEventId'),
      lastPositionId: sqlNullableText(row, 'lastPositionId'),
      latestAlarmId: sqlNullableText(row, 'latestAlarmId'),
      alarmsLast24h: sqlInteger(row, 'alarmsLast24h'),
      mainVoltageEventId: sqlNullableText(row, 'mainVoltageEventId'),
      backupVoltageEventId: sqlNullableText(row, 'backupVoltageEventId'),
      signalQualityEventId: sqlNullableText(row, 'signalQualityEventId'),
      firmwareCommandId: sqlNullableText(row, 'firmwareCommandId'),
      lastCloseReason: sqlNullableText(row, 'lastCloseReason'),
      lastClosedAt: sqlNullableDate(row, 'lastClosedAt'),
      upstreamClosesLast24h: sqlInteger(row, 'upstreamClosesLast24h'),
      initialEngineOn: nullableBoolean(row, 'initialEngineOn'),
      initialIgnitionOn: nullableBoolean(row, 'initialIgnitionOn'),
      initialSpeedKmh: nullableNumber(row, 'initialSpeedKmh'),
      initialNetworkType: sqlNullableText(row, 'initialNetworkType'),
      initialOperatorCode: sqlNullableText(row, 'initialOperatorCode'),
    }));
    const [
      selectedEvents,
      firmwareCommands,
      upstreamFrames,
      edataRows,
      recoverySessions,
      healthRows,
    ] = await Promise.all([
      this.prisma.client.ermEvent.findMany({
        where: {
          id: {
            in: rows.flatMap((row) =>
              [
                row.latestEventId,
                row.lastPositionId,
                row.latestAlarmId,
                row.mainVoltageEventId,
                row.backupVoltageEventId,
                row.signalQualityEventId,
              ].flatMap((id) => (id === null ? [] : [BigInt(id)])),
            ),
          },
        },
        include: { frame: { select: { receivedAt: true } } },
      }),
      this.prisma.client.ermCommand.findMany({
        where: {
          id: {
            in: rows.flatMap((row) =>
              row.firmwareCommandId === null ? [] : [row.firmwareCommandId],
            ),
          },
        },
      }),
      this.prisma.client.ermFrame.findMany({
        where: {
          direction: 'UPSTREAM',
          command: { in: ['04', '46'] },
          partial: false,
          receivedAt: { lte: snapshot },
          OR: [
            { unitId: { in: unitIds } },
            { unitId: null, connection: { unitId: { in: unitIds } } },
          ],
        },
        include: { connection: { select: { unitId: true } } },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.client.$queryRaw(Prisma.sql`
        SELECT DISTINCT ON (event."unitId", parameter.parameter)
          event."unitId", parameter.parameter AS "parameterId", parameter.type AS "parameterType",
          parameter."valueSize", parameter."valueHex",
          coalesce(event."eventTime", frame."receivedAt") AS "observedAt"
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        CROSS JOIN LATERAL jsonb_to_recordset(event.fields -> 'edata' -> 'parameters')
          parameter(parameter integer, type integer, "valueSize" integer, "valueHex" text)
        WHERE event."unitId" IN (${Prisma.join(unitIds)})
          AND event.fields -> 'edata' ->> 'type' = '405' AND frame."receivedAt" <= ${snapshot}
        ORDER BY event."unitId", parameter.parameter,
          coalesce(event."eventTime", frame."receivedAt") DESC, event.id DESC
      `),
      this.prisma.client.ermRecoverySession.findMany({
        where: { unitId: { in: unitIds }, finishedAt: { lte: snapshot } },
        distinct: ['unitId'],
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.client.$queryRaw(Prisma.sql`
          SELECT u."unitId", frame.id::text AS "frameId", frame."receivedAt",
            event."eventId", event."engineOn", event."speedKmh",
            CASE event.fields ->> '#IGN#' WHEN '1' THEN true WHEN '0' THEN false END AS "ignitionOn",
            nullif(event.fields ->> '#NT#', '') AS "networkType",
            nullif(event.fields ->> '#NC#', '') AS "operatorCode"
          FROM jsonb_array_elements_text(${JSON.stringify(unitIds)}::jsonb) u("unitId")
          CROSS JOIN LATERAL (
            SELECT id, "receivedAt" FROM ${this.table('ermFrame')}
            WHERE "unitId" = u."unitId" AND direction = 'device' AND NOT partial
              AND "receivedAt" >= ${since} AND "receivedAt" <= ${snapshot}
            UNION ALL
            (SELECT id, "receivedAt" FROM ${this.table('ermFrame')}
              WHERE "unitId" = u."unitId" AND direction = 'device' AND NOT partial
                AND "receivedAt" < ${since}
              ORDER BY "receivedAt" DESC, id DESC LIMIT 1)
          ) frame
          LEFT JOIN ${this.table('ermEvent')} event
            ON event."frameId" = frame.id AND event."unitId" = u."unitId"
          ORDER BY u."unitId", frame."receivedAt", frame.id, event.id
        `),
    ]);
    const healthObservations = sqlRows(healthRows).map((row) => {
      const receivedAt = sqlNullableDate(row, 'receivedAt');
      if (receivedAt === null) {
        throw new Error('Invalid ERM health database row');
      }
      return {
        unitId: sqlText(row, 'unitId'),
        frameId: sqlText(row, 'frameId'),
        receivedAt,
        eventId: sqlNullableText(row, 'eventId'),
        engineOn: nullableBoolean(row, 'engineOn'),
        ignitionOn: nullableBoolean(row, 'ignitionOn'),
        speedKmh: nullableNumber(row, 'speedKmh'),
        networkType: sqlNullableText(row, 'networkType'),
        operatorCode: sqlNullableText(row, 'operatorCode'),
      };
    });
    const edataMeasurements = sqlRows(edataRows).map((row) => {
      const observedAt = sqlNullableDate(row, 'observedAt');
      if (observedAt === null) {
        throw new Error('Invalid ERM measurement date');
      }
      return {
        unitId: sqlText(row, 'unitId'),
        parameterId: sqlInteger(row, 'parameterId'),
        parameterType: sqlInteger(row, 'parameterType'),
        valueSize: sqlInteger(row, 'valueSize'),
        valueHex: sqlText(row, 'valueHex'),
        observedAt,
      };
    });
    const events = new Map(selectedEvents.map((event) => [String(event.id), event]));
    const commands = new Map(firmwareCommands.map((command) => [command.id, command]));
    const routingWrites = upstreamFrames.filter((frame) => {
      const parsed = parseFrame(Buffer.from(frame.raw));
      return (
        parsed !== undefined &&
        (parsed.command === '04' || parsed.command === '46') &&
        parsed.fields.some(
          (field, index) =>
            index % 2 === 0 &&
            parsed.fields[index + 1] !== undefined &&
            /^\d{1,4}$/.test(field.toString('latin1')) &&
            Number(field.toString('latin1')) >= 49 &&
            Number(field.toString('latin1')) <= 54,
        )
      );
    });
    return rows.map((row) => {
      const writes = routingWrites.filter(
        (frame) => (frame.unitId ?? frame.connection.unitId) === row.unitId,
      );
      const gapsLast24h: ErmDataGap[] = [];
      let engineOn = row.initialEngineOn;
      let ignitionOn = row.initialIgnitionOn;
      let speedKmh = row.initialSpeedKmh;
      let expectedIntervalSeconds = reportingInterval(ignitionOn, engineOn, speedKmh);
      let previousFrameId: string | null = null;
      let previousFrameAt: Date | null = null;
      let networkType = row.initialNetworkType;
      let operatorCode = row.initialOperatorCode;
      let networkChangesLast24h = 0;
      let latestNetworkChange: ErmNetworkChange | null = null;
      const gapUntil = (to: Date) => {
        if (
          previousFrameAt === null ||
          to.getTime() - previousFrameAt.getTime() <= 2 * expectedIntervalSeconds * 1000
        ) {
          return;
        }
        const from = new Date(Math.max(previousFrameAt.getTime(), since.getTime()));
        gapsLast24h.push({
          from,
          to,
          durationSeconds: Math.floor((to.getTime() - from.getTime()) / 1000),
          expectedIntervalSeconds,
        });
      };
      for (const observation of healthObservations.filter((entry) => entry.unitId === row.unitId)) {
        if (observation.frameId !== previousFrameId) {
          gapUntil(observation.receivedAt);
          previousFrameId = observation.frameId;
          previousFrameAt = observation.receivedAt;
        }
        engineOn = observation.engineOn ?? engineOn;
        ignitionOn = observation.ignitionOn ?? ignitionOn;
        speedKmh = observation.speedKmh ?? speedKmh;
        expectedIntervalSeconds = reportingInterval(ignitionOn, engineOn, speedKmh);
        const changed =
          Number(observation.eventId) === 23 ||
          (observation.networkType !== null &&
            networkType !== null &&
            observation.networkType !== networkType) ||
          (observation.operatorCode !== null &&
            operatorCode !== null &&
            observation.operatorCode !== operatorCode);
        networkType = observation.networkType ?? networkType;
        operatorCode = observation.operatorCode ?? operatorCode;
        if (changed && observation.receivedAt >= since) {
          networkChangesLast24h++;
          latestNetworkChange = {
            at: observation.receivedAt,
            networkType,
            operatorCode,
          };
        }
      }
      gapUntil(snapshot);
      return {
        ...row,
        expectedIntervalSeconds,
        gapsLast24h,
        networkChangesLast24h,
        latestNetworkChange,
        recovery: recoverySessions.find((session) => session.unitId === row.unitId) ?? null,
        latestEvent: events.get(row.latestEventId ?? '') ?? null,
        lastPosition: events.get(row.lastPositionId ?? '') ?? null,
        latestAlarm: events.get(row.latestAlarmId ?? '') ?? null,
        mainVoltageEvent: events.get(row.mainVoltageEventId ?? '') ?? null,
        backupVoltageEvent: events.get(row.backupVoltageEventId ?? '') ?? null,
        signalQualityEvent: events.get(row.signalQualityEventId ?? '') ?? null,
        firmwareCommand: commands.get(row.firmwareCommandId ?? '') ?? null,
        edataMeasurements: edataMeasurements.filter(
          (measurement) => measurement.unitId === row.unitId,
        ),
        karmaRoutingWritesLast24h: writes.filter((frame) => frame.receivedAt >= since).length,
        latestKarmaRoutingWrite: writes[0] ?? null,
      };
    });
  }

  async deviceEvents(queries: TelemetryQuery[], categories?: readonly ErmEventCategory[] | null) {
    const ids = categories ? categoryEventIds(categories) : [];
    const known = [...starlinkEvents.keys()];
    const filter = !categories
      ? Prisma.sql`true`
      : Prisma.sql`(
      ${ids.length ? Prisma.sql`event."eventId" IN (${Prisma.join(ids)})` : Prisma.sql`false`}
      OR ${
        categories.includes('OTHER')
          ? Prisma.sql`(event."eventId" IS NULL OR event."eventId" NOT IN (${Prisma.join(known)}))`
          : Prisma.sql`false`
      }
    )`;
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT q."unitId", h.id::text AS id FROM
      jsonb_to_recordset(${JSON.stringify(queries)}::jsonb) q("unitId" text, "offset" integer, "pageSize" integer, snapshot timestamptz)
      CROSS JOIN LATERAL (
        SELECT event.id, event."eventTime" FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = q."unitId" AND frame."receivedAt" <= q.snapshot AND ${filter}
        ORDER BY event."eventTime" DESC NULLS LAST, event.id DESC
        LIMIT q."pageSize" + 1 OFFSET q."offset"
      ) h ORDER BY q."unitId", h."eventTime" DESC NULLS LAST, h.id DESC
    `),
    );
    const rows = new Map(
      (
        await this.prisma.client.ermEvent.findMany({
          where: { id: { in: selected.map((row) => BigInt(sqlText(row, 'id'))) } },
        })
      ).map((event) => [String(event.id), event]),
    );
    return queries.map((query) => ({
      query,
      rows: selected
        .filter((row) => sqlText(row, 'unitId') === query.unitId)
        .flatMap((row) => {
          const event = rows.get(sqlText(row, 'id'));
          return event ? [event] : [];
        }),
    }));
  }

  async deviceFrames(queries: TelemetryQuery[]) {
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT q."unitId", h.id::text AS id FROM
      jsonb_to_recordset(${JSON.stringify(queries)}::jsonb) q("unitId" text, "offset" integer, "pageSize" integer, snapshot timestamptz)
      CROSS JOIN LATERAL (
        SELECT frame.id, frame."receivedAt" FROM ${this.table('ermFrame')} frame
        WHERE (frame."unitId" = q."unitId" OR (frame."unitId" IS NULL AND EXISTS (
          SELECT 1 FROM ${this.table('ermConnection')} c WHERE c.id = frame."connectionId" AND c."unitId" = q."unitId"
        ))) AND frame."receivedAt" <= q.snapshot
        ORDER BY frame."receivedAt" DESC, frame.id DESC
        LIMIT q."pageSize" + 1 OFFSET q."offset"
      ) h ORDER BY q."unitId", h."receivedAt" DESC, h.id DESC
    `),
    );
    const rows = new Map(
      (
        await this.prisma.client.ermFrame.findMany({
          where: { id: { in: selected.map((row) => BigInt(sqlText(row, 'id'))) } },
        })
      ).map((frame) => [String(frame.id), frame]),
    );
    return queries.map((query) => ({
      query,
      rows: selected
        .filter((row) => sqlText(row, 'unitId') === query.unitId)
        .flatMap((row) => {
          const frame = rows.get(sqlText(row, 'id'));
          return frame ? [frame] : [];
        }),
    }));
  }

  async deviceCommands(queries: TelemetryQuery[]) {
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT q."unitId", h.id::text AS id FROM
      jsonb_to_recordset(${JSON.stringify(queries)}::jsonb) q("unitId" text, "offset" integer, "pageSize" integer, snapshot timestamptz)
      CROSS JOIN LATERAL (
        SELECT id, "sentAt" FROM ${this.table('ermCommand')}
        WHERE "unitId" = q."unitId" AND "sentAt" <= q.snapshot
        ORDER BY "sentAt" DESC, id DESC LIMIT q."pageSize" + 1 OFFSET q."offset"
      ) h ORDER BY q."unitId", h."sentAt" DESC, h.id DESC
    `),
    );
    const rows = new Map(
      (
        await this.prisma.client.ermCommand.findMany({
          where: { id: { in: selected.map((row) => sqlText(row, 'id')) } },
        })
      ).map((command) => [command.id, command]),
    );
    return queries.map((query) => ({
      query,
      rows: selected
        .filter((row) => sqlText(row, 'unitId') === query.unitId)
        .flatMap((row) => {
          const command = rows.get(sqlText(row, 'id'));
          return command ? [command] : [];
        }),
    }));
  }

  command(id: string) {
    return this.prisma.client.ermCommand.findUnique({ where: { id } });
  }
}
