import { BadRequestException, Injectable } from '@nestjs/common';
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
import { categoryEventIds, starlinkEvents } from '../../starlink/event-catalog.js';
import type { TelemetryQuery } from './telemetry-query.js';

function historyUnit(query: TelemetryQuery): string {
  if (query.unitId === undefined) {
    throw new BadRequestException('An ERM unit is required for history');
  }
  return query.unitId;
}

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private table(name: 'ermConnection' | 'ermFrame' | 'ermEvent' | 'ermCommand') {
    return Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async deviceStates(unitIds: string[], snapshot: Date) {
    const alarms = categoryEventIds(['ALARM']);
    const since = new Date(snapshot.getTime() - 24 * 60 * 60 * 1000);
    const rows = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT u."unitId", c.id::text AS "connectionId", f."receivedAt" AS "lastFrameAt",
        e.id::text AS "latestEventId", p.id::text AS "lastPositionId", a.id::text AS "latestAlarmId",
        n.count AS "alarmsLast24h"
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
        ORDER BY event."eventTime" DESC NULLS LAST, event.id DESC LIMIT 1
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
    `),
    ).map((row) => ({
      unitId: sqlText(row, 'unitId'),
      connectionId: sqlNullableText(row, 'connectionId'),
      lastFrameAt: sqlNullableDate(row, 'lastFrameAt'),
      latestEventId: sqlNullableText(row, 'latestEventId'),
      lastPositionId: sqlNullableText(row, 'lastPositionId'),
      latestAlarmId: sqlNullableText(row, 'latestAlarmId'),
      alarmsLast24h: sqlInteger(row, 'alarmsLast24h'),
    }));
    const events = new Map(
      (
        await this.prisma.client.ermEvent.findMany({
          where: {
            id: {
              in: rows.flatMap((row) =>
                [row.latestEventId, row.lastPositionId, row.latestAlarmId].flatMap((id) =>
                  id === null ? [] : [BigInt(id)],
                ),
              ),
            },
          },
        })
      ).map((event) => [String(event.id), event]),
    );
    return rows.map((row) => ({
      ...row,
      latestEvent: events.get(row.latestEventId ?? '') ?? null,
      lastPosition: events.get(row.lastPositionId ?? '') ?? null,
      latestAlarm: events.get(row.latestAlarmId ?? '') ?? null,
    }));
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

  async units(query: TelemetryQuery) {
    const groups = await this.prisma.client.ermConnection.groupBy({
      by: ['unitId'],
      where: { unitId: { not: null }, openedAt: { lte: query.snapshot } },
      _max: { openedAt: true },
      orderBy: [{ _max: { openedAt: 'desc' } }, { unitId: 'asc' }],
      skip: query.offset,
      take: query.pageSize + 1,
    });
    const units = groups.flatMap((group) => (group.unitId === null ? [] : [group.unitId]));
    const [connections, frames, eventTimes] = await Promise.all([
      this.prisma.client.ermConnection.findMany({
        where: {
          OR: groups.flatMap((group) =>
            group.unitId === null || group._max.openedAt === null
              ? []
              : [{ unitId: group.unitId, openedAt: group._max.openedAt }],
          ),
        },
        orderBy: { id: 'desc' },
        distinct: ['unitId'],
      }),
      this.prisma.client.ermFrame.groupBy({
        by: ['unitId'],
        where: {
          unitId: { in: units },
          direction: 'DEVICE',
          partial: false,
          receivedAt: { lte: query.snapshot },
        },
        _max: { receivedAt: true },
      }),
      this.prisma.client.ermEvent.groupBy({
        by: ['unitId'],
        where: { unitId: { in: units }, frame: { receivedAt: { lte: query.snapshot } } },
        _max: { eventTime: true },
      }),
    ]);
    const eventIds = await this.prisma.client.ermEvent.groupBy({
      by: ['unitId'],
      where: {
        OR: eventTimes.map((event) => ({ unitId: event.unitId, eventTime: event._max.eventTime })),
        frame: { receivedAt: { lte: query.snapshot } },
      },
      _max: { id: true },
    });
    const events = await this.prisma.client.ermEvent.findMany({
      where: {
        id: { in: eventIds.flatMap((event) => (event._max.id === null ? [] : [event._max.id])) },
      },
    });
    return units.map((unitId) => ({
      unitId,
      connection: connections.find((connection) => connection.unitId === unitId),
      lastFrameAt: frames.find((frame) => frame.unitId === unitId)?._max.receivedAt ?? null,
      latestEvent: events.find((event) => event.unitId === unitId) ?? null,
    }));
  }

  events(query: TelemetryQuery) {
    return this.prisma.client.ermEvent.findMany({
      where: { unitId: historyUnit(query), frame: { receivedAt: { lte: query.snapshot } } },
      orderBy: [{ eventTime: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      skip: query.offset,
      take: query.pageSize + 1,
    });
  }

  frames(query: TelemetryQuery) {
    const unitId = historyUnit(query);
    return this.prisma.client.ermFrame.findMany({
      where: {
        OR: [{ unitId }, { unitId: null, connection: { unitId } }],
        receivedAt: { lte: query.snapshot },
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.pageSize + 1,
    });
  }

  commands(query: TelemetryQuery) {
    return this.prisma.client.ermCommand.findMany({
      where: { unitId: historyUnit(query), sentAt: { lte: query.snapshot } },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.pageSize + 1,
    });
  }
}
