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
import type { ErmEventCategory } from '../../generated/graphql/types.js';
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

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private table(
    name: 'ermConnection' | 'ermFrame' | 'ermEvent' | 'ermCommand' | 'ermUpstreamClose',
  ) {
    return Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async internalEvents(imei: string, after: string, limit: number, receivedBefore: Date) {
    return sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT event.id::text AS id, event."eventId", event."eventTime", frame."receivedAt",
          event.latitude::double precision AS latitude, event.longitude::double precision AS longitude,
          event."speedKmh", event.heading, event.odometer AS "odometerKm", event."engineOn",
          event."mainVoltage", event."backupVoltage"
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
        closed."closedAt" AS "lastClosedAt", uc.count AS "upstreamClosesLast24h"
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
    }));
    const [selectedEvents, firmwareCommands, upstreamFrames] = await Promise.all([
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
    ]);
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
      return {
        ...row,
        latestEvent: events.get(row.latestEventId ?? '') ?? null,
        lastPosition: events.get(row.lastPositionId ?? '') ?? null,
        latestAlarm: events.get(row.latestAlarmId ?? '') ?? null,
        mainVoltageEvent: events.get(row.mainVoltageEventId ?? '') ?? null,
        backupVoltageEvent: events.get(row.backupVoltageEventId ?? '') ?? null,
        signalQualityEvent: events.get(row.signalQualityEventId ?? '') ?? null,
        firmwareCommand: commands.get(row.firmwareCommandId ?? '') ?? null,
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
