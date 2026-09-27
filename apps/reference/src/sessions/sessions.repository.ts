import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const include = {
  speakers: { include: { speaker: true }, orderBy: { speakerId: 'asc' as const } },
};
export type SessionRow = Prisma.SessionGetPayload<{ include: typeof include }>;
export type SessionWrite = Pick<SessionRow, 'title' | 'summary' | 'startsAt' | 'endsAt' | 'room'>;

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(storeId: string, eventId: string, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.session.findMany({
      where: { storeId, eventId, event: { deletedAt: null } },
      include,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }
  find(
    storeId: string,
    eventId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma.client,
  ) {
    return tx.session.findUnique({
      where: { id, storeId, eventId, event: { deletedAt: null } },
      include,
    });
  }
  speakers(tx: Prisma.TransactionClient, storeId: string, ids: string[]) {
    return tx.speaker.findMany({
      where: { storeId, id: { in: ids } },
      select: { id: true, active: true },
    });
  }
  positions(tx: Prisma.TransactionClient, storeId: string, eventId: string) {
    return tx.session.aggregate({
      where: { storeId, eventId, event: { deletedAt: null } },
      _count: true,
      _max: { position: true },
    });
  }
  create(
    tx: Prisma.TransactionClient,
    storeId: string,
    eventId: string,
    data: SessionWrite,
    speakerIds: string[],
    position: number,
  ) {
    return tx.session.create({
      data: {
        ...data,
        storeId,
        eventId,
        position,
        speakers: { create: speakerIds.map((speakerId) => ({ speakerId })) },
      },
      include,
    });
  }
  update(
    tx: Prisma.TransactionClient,
    storeId: string,
    eventId: string,
    id: string,
    data: SessionWrite,
    speakerIds: string[] | undefined,
  ) {
    return tx.session.update({
      where: { id, storeId, eventId },
      data: {
        ...data,
        ...(speakerIds === undefined
          ? {}
          : {
              speakers: {
                deleteMany: { storeId, sessionId: id },
                create: speakerIds.map((speakerId) => ({ speakerId })),
              },
            }),
      },
      include,
    });
  }
  delete(tx: Prisma.TransactionClient, storeId: string, eventId: string, id: string) {
    return tx.session.delete({ where: { id, storeId, eventId }, include });
  }
  async reorder(tx: Prisma.TransactionClient, storeId: string, eventId: string, ids: string[]) {
    for (const [position, id] of ids.entries())
      await tx.session.update({ where: { id, storeId, eventId }, data: { position } });
    return this.list(storeId, eventId, tx);
  }
}
