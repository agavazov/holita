import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
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
