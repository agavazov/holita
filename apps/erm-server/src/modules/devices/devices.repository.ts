import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ErmChecksum, ErmDirection } from '../../generated/prisma/client.js';
import type { CaptureRecord } from './capture-record.js';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async open(id: string, peer: string, upstream: string, openedAt: Date): Promise<void> {
    await this.prisma.client.ermConnection.create({ data: { id, peer, upstream, openedAt } });
  }

  async forwarded(id: string, forwardedAt: Date): Promise<void> {
    await this.prisma.client.ermConnection.update({ where: { id }, data: { forwardedAt } });
  }

  async frame(
    connectionId: string,
    receivedAt: Date,
    entry: Extract<CaptureRecord, { from: string }>,
    firstDeviceUnit: boolean,
  ): Promise<void> {
    if (firstDeviceUnit) {
      await this.prisma.client.ermConnection.update({
        where: { id: connectionId },
        data: { unitId: entry.unit ?? null },
      });
    }
    await this.prisma.client.ermFrame.create({
      data: {
        connectionId,
        receivedAt,
        direction: entry.from === 'device' ? ErmDirection.DEVICE : ErmDirection.UPSTREAM,
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
