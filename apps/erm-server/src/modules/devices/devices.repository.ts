import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { sqlRows } from '../../database/sql.js';
import {
  ErmChecksum,
  ErmCommandStatus,
  ErmDirection,
  Prisma,
} from '../../generated/prisma/client.js';
import {
  decodeBinaryEvent,
  decodeEvent,
  inflateContainer,
  parseFrame,
} from '../../starlink/index.js';
import type { DecodedEvent } from '../../starlink/index.js';
import type { CaptureRecord, CommandOutcome, SentCommand } from './capture-record.js';

@Injectable()
export class DevicesRepository {
  private readonly logger = new Logger(DevicesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async closeLeftOpen(): Promise<number> {
    const schema = Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"`);
    const rows = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      UPDATE ${schema}."ermConnection" AS connection
      SET "closedAt" = COALESCE(
        (SELECT MAX(frame."receivedAt") FROM ${schema}."ermFrame" AS frame
         WHERE frame."connectionId" = connection."id"),
        connection."forwardedAt",
        connection."openedAt"
      ), "closeReason" = 'left open by a previous process'
      WHERE connection."closedAt" IS NULL
      RETURNING connection."id"
    `),
    );
    return rows.length;
  }

  async open(id: string, peer: string, upstream: string, openedAt: Date): Promise<void> {
    await this.prisma.client.ermConnection.create({ data: { id, peer, upstream, openedAt } });
  }

  async forwarded(id: string, forwardedAt: Date): Promise<void> {
    await this.prisma.client.ermConnection.updateMany({
      where: { id, forwardedAt: null },
      data: { forwardedAt },
    });
  }

  async upstreamClose(connectionId: string, closedAt: Date, reason: string): Promise<void> {
    await this.prisma.client.ermUpstreamClose.create({ data: { connectionId, closedAt, reason } });
  }

  async frame(
    connectionId: string,
    receivedAt: Date,
    entry: Extract<CaptureRecord, { from: string }>,
    firstDeviceUnit: boolean,
    eventStructure: readonly string[],
  ): Promise<void> {
    if (firstDeviceUnit) {
      await this.prisma.client.ermConnection.update({
        where: { id: connectionId },
        data: { unitId: entry.unit ?? null },
      });
    }
    const frame = await this.prisma.client.ermFrame.create({
      data: {
        connectionId,
        receivedAt,
        direction: {
          device: ErmDirection.DEVICE,
          server: ErmDirection.UPSTREAM,
          holita: ErmDirection.HOLITA,
        }[entry.from],
        unitId: entry.unit ?? null,
        command: entry.command ?? null,
        reference: entry.reference ?? null,
        checksum: {
          ok: ErmChecksum.OK,
          mismatch: ErmChecksum.MISMATCH,
          absent: ErmChecksum.ABSENT,
        }[entry.checksum ?? 'absent'],
        partial: entry.partial ?? false,
        raw: Buffer.from(entry.frame, 'latin1'),
      },
    });
    if (entry.from !== 'device' || entry.partial) {
      return;
    }
    // Tracker units send binary $SLB reports and batch frames into compressed $SLC containers.
    const raw = Buffer.from(entry.frame, 'latin1');
    const container = entry.command === undefined ? inflateContainer(raw) : undefined;
    const binary = entry.command === undefined && !container;
    for (const inner of container ??
      (binary || entry.command === '06' || entry.command === '86' ? [raw] : [])) {
      let event: DecodedEvent | undefined;
      try {
        if (inner.subarray(0, 4).toString('latin1') === '$SLB') {
          event = decodeBinaryEvent(inner);
          if (event) {
            await this.prisma.client.ermEvent.create({ data: { frameId: frame.id, ...event } });
          }
          continue;
        }
        const parsed = parseFrame(inner);
        if (!parsed) {
          throw new Error('Invalid event envelope.');
        }
        if (parsed.command !== '06' && parsed.command !== '86') {
          continue;
        }
        event = decodeEvent(parsed, eventStructure);
      } catch {
        this.logger.error('Event decoding failed; forwarding and confirmations continue.');
        return;
      }
      if (event) {
        await this.prisma.client.ermEvent.create({ data: { frameId: frame.id, ...event } });
      }
    }
  }

  async commandSent(connectionId: string, command: SentCommand): Promise<void> {
    await this.prisma.client.ermCommand.create({ data: { connectionId, ...command } });
  }

  async commandFinished(id: string, outcome: CommandOutcome): Promise<void> {
    await this.prisma.client.ermCommand.update({
      where: { id },
      data: {
        status: {
          answered: ErmCommandStatus.ANSWERED,
          timeout: ErmCommandStatus.TIMEOUT,
          failed: ErmCommandStatus.FAILED,
        }[outcome.status],
        answeredAt: outcome.answeredAt ?? null,
        resultCode: outcome.resultCode ?? null,
        response: outcome.response === undefined ? null : Buffer.from(outcome.response),
      },
    });
  }

  async close(
    id: string,
    closedAt: Date,
    closeReason: string,
    deviceBytes: number,
    serverBytes: number,
  ): Promise<void> {
    await this.prisma.client.ermConnection.update({
      where: { id },
      data: {
        closedAt,
        closeReason,
        deviceBytes: BigInt(deviceBytes),
        serverBytes: BigInt(serverBytes),
      },
    });
  }
}
