import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  ReferenceEventChange,
  ReferenceEventHistoryOperation,
} from '../generated/graphql/types.js';

type HistoryEntry = {
  eventId: string;
  operation: ReferenceEventHistoryOperation;
  changes: ReferenceEventChange[];
  subject?: string | null;
};

function readChanges(value: Prisma.JsonValue): ReferenceEventChange[] {
  if (!Array.isArray(value)) throw new Error('Invalid event history changes');
  return value.map((change) => {
    if (
      !change ||
      typeof change !== 'object' ||
      Array.isArray(change) ||
      typeof change.field !== 'string' ||
      (change.before !== null && typeof change.before !== 'string') ||
      (change.after !== null && typeof change.after !== 'string')
    )
      throw new Error('Invalid event history change');
    return { field: change.field, before: change.before, after: change.after };
  });
}

@Injectable()
export class EventHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(storeId: string, eventId: string, offset: number, limit: number) {
    const where = { storeId, eventId };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.eventHistory.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.client.eventHistory.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: items.map((row) => ({ ...row, changes: readChanges(row.changes) })),
      total,
      offset,
      limit,
    };
  }
  record(
    tx: Prisma.TransactionClient,
    storeId: string,
    eventId: string,
    operation: ReferenceEventHistoryOperation,
    changes: ReferenceEventChange[],
    subject: string | null = null,
  ) {
    return this.recordMany(tx, storeId, [{ eventId, operation, changes, subject }]);
  }
  recordMany(
    tx: Prisma.TransactionClient,
    storeId: string,
    entries: HistoryEntry[],
  ): Promise<Prisma.BatchPayload> {
    return tx.eventHistory.createMany({
      data: entries.map(({ eventId, operation, changes, subject }) => ({
        storeId,
        eventId,
        operation,
        subject: subject ?? null,
        changes: changes.map(({ field, before, after }) => ({
          field,
          before: before ?? null,
          after: after ?? null,
        })),
      })),
    });
  }
}
