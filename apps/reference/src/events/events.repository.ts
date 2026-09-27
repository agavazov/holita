import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { ReferenceEventFilter, ReferenceEventSort } from '../generated/graphql/types.js';
import pg from 'pg';
import { Prisma } from '../generated/prisma/client.js';

export type EventWrite = Omit<
  Prisma.EventUncheckedCreateInput,
  | 'id'
  | 'storeId'
  | 'tags'
  | 'history'
  | 'sessions'
  | 'media'
  | 'uploadIntents'
  | 'coverMediaId'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | 'startsAt'
  | 'endsAt'
> & { startsAt: Date; endsAt: Date };
const include = { venue: true, tags: { include: { tag: true } } };
export type EventRow = Prisma.EventGetPayload<{ include: typeof include }>;

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    storeId: string,
    offset: number,
    limit: number,
    filter: ReferenceEventFilter,
    sort: Required<ReferenceEventSort>,
  ) {
    const search = filter.search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.EventWhereInput = {
      storeId,
      deletedAt: filter.trashed ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      ...(filter.formats?.length ? { format: { in: filter.formats } } : {}),
      ...(filter.venueIds?.length ? { venueId: { in: filter.venueIds } } : {}),
      ...(filter.tagIds?.length
        ? { tags: { some: { storeId, tagId: { in: filter.tagIds } } } }
        : {}),
      ...(filter.featured != null ? { featured: filter.featured } : {}),
      ...(filter.startsAtFrom || filter.startsAtBefore
        ? {
            startsAt: {
              ...(filter.startsAtFrom ? { gte: filter.startsAtFrom } : {}),
              ...(filter.startsAtBefore ? { lt: filter.startsAtBefore } : {}),
            },
          }
        : {}),
      ...(filter.capacityMin != null || filter.capacityMax != null
        ? {
            capacity: {
              ...(filter.capacityMin != null ? { gte: filter.capacityMin } : {}),
              ...(filter.capacityMax != null ? { lte: filter.capacityMax } : {}),
            },
          }
        : {}),
    };
    const direction = sort.direction === 'DESC' ? 'desc' : 'asc';
    const ordering: Record<
      Required<ReferenceEventSort>['field'],
      Prisma.EventOrderByWithRelationInput
    > = {
      TITLE: { title: direction },
      STARTS_AT: { startsAt: direction },
      STATUS: { status: direction },
      CAPACITY: { capacity: { sort: direction, nulls: 'last' } },
      BUDGET: { budget: { sort: direction, nulls: 'last' } },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.event.findMany({
          where,
          skip: offset,
          take: limit,
          include,
          orderBy: [ordering[sort.field], { id: 'asc' }],
        }),
        this.prisma.client.event.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(storeId: string, id: string, includeDeleted = false) {
    return this.prisma.client.event.findUnique({
      where: { id, storeId, ...(includeDeleted ? {} : { deletedAt: null }) },
      include,
    });
  }
  venue(storeId: string, id: string, tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.venue.findUnique({
      where: { id, storeId },
      select: { id: true, active: true },
    });
  }
  tags(storeId: string, ids: string[], tx: Prisma.TransactionClient = this.prisma.client) {
    return tx.tag.findMany({
      where: { storeId, id: { in: ids } },
      select: { id: true, active: true },
    });
  }
  create(storeId: string, data: EventWrite, tagIds: string[]) {
    return this.prisma.client.event.create({
      data: {
        ...data,
        storeId,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        history: {
          create: {
            operation: 'CREATED',
            changes: [
              { field: 'title', before: null, after: data.title },
              { field: 'code', before: null, after: data.code },
            ],
          },
        },
      },
      include,
    });
  }
  // All parent/child writers share this lock; sorted bulk locks avoid opposing lock orders.
  withLockedEvent<T>(
    storeId: string,
    id: string,
    change: (event: EventRow, tx: Prisma.TransactionClient) => Promise<T>,
    includeDeleted = false,
  ): Promise<T> {
    return this.withLockedEvents(storeId, [id], async (rows, tx) => {
      const locked = rows[0];
      if (!locked || (!includeDeleted && locked.deletedAt))
        throw new NotFoundException('Event not found');
      const event = await tx.event.findUniqueOrThrow({ where: { id, storeId }, include });
      return change(event, tx);
    });
  }
  withLockedEvents<T>(
    storeId: string,
    ids: string[],
    change: (
      events: Pick<EventRow, 'id' | 'status' | 'deletedAt'>[],
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.client.$transaction(async (tx) => {
      const events = await tx.$queryRaw<Pick<EventRow, 'id' | 'status' | 'deletedAt'>[]>`
        SELECT "id", "status", "deletedAt" FROM ${Prisma.raw(pg.escapeIdentifier(this.prisma.schema))}."Event"
        WHERE "storeId" = ${storeId}::uuid AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY "id" FOR UPDATE`;
      if (events.length !== ids.length)
        throw new NotFoundException('One or more events were not found');
      return change(events, tx);
    });
  }
  sessionBounds(tx: Prisma.TransactionClient, storeId: string, eventId: string) {
    return tx.session.aggregate({
      where: { storeId, eventId },
      _min: { startsAt: true },
      _max: { endsAt: true },
    });
  }
  update(
    tx: Prisma.TransactionClient,
    storeId: string,
    id: string,
    data: EventWrite,
    tagIds: string[] | undefined,
  ) {
    return tx.event.update({
      where: { id, storeId, deletedAt: null },
      data: {
        ...data,
        ...(tagIds === undefined
          ? {}
          : {
              tags: {
                deleteMany: { storeId, eventId: id },
                create: tagIds.map((tagId) => ({ tagId })),
              },
            }),
      },
      include,
    });
  }
  setDeleted(tx: Prisma.TransactionClient, storeId: string, id: string, deletedAt: Date | null) {
    return tx.event.update({ where: { id, storeId }, data: { deletedAt }, include });
  }
  bulk(
    tx: Prisma.TransactionClient,
    storeId: string,
    ids: string[],
    data: Pick<Prisma.EventUpdateManyMutationInput, 'status' | 'deletedAt'>,
  ) {
    return tx.event.updateMany({ where: { storeId, id: { in: ids } }, data });
  }
}
