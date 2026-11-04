import { isDeepStrictEqual } from 'node:util';
import {
  ErmDirection,
  Prisma,
  type ErmEvent,
  type PrismaClient,
} from '../../generated/prisma/client.js';
import { decodeFrameEvents, type DecodedEvent } from '../../starlink/index.js';

export interface RedecodeSummary {
  framesScanned: number;
  eventsUpdated: number;
  eventsInserted: number;
  surplusEvents: number;
  decodeFailures: number;
  duplicates: number;
}

function eventData(event: DecodedEvent) {
  return {
    ...event,
    latitude:
      event.latitude === null ? null : new Prisma.Decimal(event.latitude).toDecimalPlaces(7),
    longitude:
      event.longitude === null ? null : new Prisma.Decimal(event.longitude).toDecimalPlaces(7),
  };
}

function matches(stored: ErmEvent, decoded: ReturnType<typeof eventData>): boolean {
  return (
    stored.unitId === decoded.unitId &&
    stored.reference === decoded.reference &&
    stored.eventId === decoded.eventId &&
    stored.eventTime?.getTime() === decoded.eventTime?.getTime() &&
    stored.positionTime?.getTime() === decoded.positionTime?.getTime() &&
    stored.latitude?.toString() === decoded.latitude?.toString() &&
    stored.longitude?.toString() === decoded.longitude?.toString() &&
    stored.speedKmh === decoded.speedKmh &&
    stored.heading === decoded.heading &&
    stored.odometer === decoded.odometer &&
    stored.engineOn === decoded.engineOn &&
    stored.mainVoltage === decoded.mainVoltage &&
    stored.backupVoltage === decoded.backupVoltage &&
    isDeepStrictEqual(stored.fields, decoded.fields)
  );
}

export async function redecodeFrames(
  client: PrismaClient,
  eventStructure: readonly string[],
  startedAt = new Date(),
): Promise<RedecodeSummary> {
  const cutoff = new Date(startedAt.getTime() - 60_000);
  const summary: RedecodeSummary = {
    framesScanned: 0,
    eventsUpdated: 0,
    eventsInserted: 0,
    surplusEvents: 0,
    decodeFailures: 0,
    duplicates: 0,
  };
  let after: bigint | undefined;
  for (;;) {
    const frames = await client.ermFrame.findMany({
      where: {
        direction: ErmDirection.DEVICE,
        partial: false,
        receivedAt: { lte: cutoff },
        ...(after === undefined ? {} : { id: { gt: after } }),
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: { events: { orderBy: { id: 'asc' } } },
    });
    if (frames.length === 0) {
      return summary;
    }
    for (const frame of frames) {
      summary.framesScanned++;
      after = frame.id;
      const events: DecodedEvent[] = [];
      try {
        for (const event of decodeFrameEvents(
          Buffer.from(frame.raw),
          frame.command,
          eventStructure,
        )) {
          events.push(event);
        }
      } catch {
        summary.decodeFailures++;
      }
      summary.surplusEvents += Math.max(0, frame.events.length - events.length);
      for (const [position, event] of events.entries()) {
        const stored = frame.events[position];
        const data = eventData(event);
        try {
          if (stored === undefined) {
            await client.ermEvent.create({ data: { frameId: frame.id, ...data } });
            summary.eventsInserted++;
          } else if (!matches(stored, data)) {
            await client.ermEvent.update({ where: { id: stored.id }, data });
            summary.eventsUpdated++;
          }
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
            throw error;
          }
          summary.duplicates++;
        }
      }
    }
  }
}
