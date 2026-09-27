import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(storeId: string, eventId: string, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.eventMedia.findMany({
      where: { storeId, eventId, event: { deletedAt: null } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }
  find(storeId: string, id: string, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.eventMedia.findUnique({ where: { id, storeId, event: { deletedAt: null } } });
  }
  intent(storeId: string, id: string, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.uploadIntent.findUnique({ where: { id, storeId } });
  }
  uploadCapability(id: string, tokenHash: string) {
    return this.prisma.client.uploadIntent.findUnique({
      where: { id, tokenHash, event: { deletedAt: null } },
    });
  }
  pending(tx: Prisma.TransactionClient, storeId: string, eventId: string) {
    return tx.uploadIntent.count({
      where: {
        storeId,
        eventId,
        OR: [
          { state: { in: ['PENDING', 'UPLOADING'] }, expiresAt: { gt: new Date() } },
          { state: 'UPLOADED', finalizeExpiresAt: { gt: new Date() } },
        ],
      },
    });
  }
  createIntent(tx: Prisma.TransactionClient, data: Prisma.UploadIntentUncheckedCreateInput) {
    return tx.uploadIntent.create({ data });
  }
  claimUpload(storeId: string, id: string) {
    return this.prisma.client.uploadIntent.updateMany({
      where: {
        id,
        storeId,
        state: 'PENDING',
        expiresAt: { gt: new Date() },
        event: { deletedAt: null },
      },
      data: { state: 'UPLOADING' },
    });
  }
  finishUpload(storeId: string, id: string, failed = false) {
    return this.prisma.client.uploadIntent.updateMany({
      where: { id, storeId, state: 'UPLOADING' },
      data: { state: failed ? 'DELETING' : 'UPLOADED' },
    });
  }
  claimFinalize(tx: Prisma.TransactionClient, storeId: string, id: string) {
    return tx.uploadIntent.updateMany({
      where: { id, storeId, state: 'UPLOADED', finalizeExpiresAt: { gt: new Date() } },
      data: { state: 'FINALIZED' },
    });
  }
  createMedia(tx: Prisma.TransactionClient, data: Prisma.EventMediaUncheckedCreateInput) {
    return tx.eventMedia.create({ data });
  }
  update(
    tx: Prisma.TransactionClient,
    storeId: string,
    eventId: string,
    id: string,
    altText: string | null,
  ) {
    return tx.eventMedia.update({ where: { id, storeId, eventId }, data: { altText } });
  }
  cover(tx: Prisma.TransactionClient, storeId: string, eventId: string, id: string | null) {
    return tx.event.update({
      where: { id: eventId, storeId, deletedAt: null },
      data: { coverMediaId: id },
    });
  }
  async remove(
    tx: Prisma.TransactionClient,
    storeId: string,
    eventId: string,
    id: string,
    uploadId: string,
  ) {
    await tx.eventMedia.delete({ where: { id, storeId, eventId } });
    await tx.uploadIntent.update({
      where: { id: uploadId, storeId, eventId },
      data: { state: 'DELETING' },
    });
  }
  async reorder(tx: Prisma.TransactionClient, storeId: string, eventId: string, ids: string[]) {
    for (const [position, id] of ids.entries())
      await tx.eventMedia.update({ where: { id, storeId, eventId }, data: { position } });
    return this.list(storeId, eventId, tx);
  }
  cleanupCandidates(activeIds: string[]) {
    const now = new Date();
    return this.prisma.client.uploadIntent.findMany({
      where: {
        id: { notIn: activeIds },
        media: null,
        OR: [
          { state: 'DELETING' },
          { state: { in: ['PENDING', 'UPLOADING'] }, expiresAt: { lte: now } },
          { state: 'UPLOADED', finalizeExpiresAt: { lte: now } },
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
  }
  claimCleanup(storeId: string, id: string) {
    const now = new Date();
    return this.prisma.client.uploadIntent.updateMany({
      where: {
        id,
        storeId,
        media: null,
        OR: [
          { state: 'DELETING' },
          { state: { in: ['PENDING', 'UPLOADING'] }, expiresAt: { lte: now } },
          { state: 'UPLOADED', finalizeExpiresAt: { lte: now } },
        ],
      },
      data: { state: 'DELETING' },
    });
  }
  forget(storeId: string, id: string) {
    return this.prisma.client.uploadIntent.deleteMany({
      where: { id, storeId, state: 'DELETING', media: null },
    });
  }
}
