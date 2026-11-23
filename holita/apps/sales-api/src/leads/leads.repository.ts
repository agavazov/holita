import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { LeadSort } from '../generated/graphql/types.js';
import { Prisma, type Lead } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';

type LeadFields = Pick<Lead, 'displayName' | 'websiteUrl' | 'sourceName'>;

@Injectable()
export class LeadsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    { tenantId }: SalesScope,
    offset: number,
    limit: number,
    words: string[],
    sort?: LeadSort | null,
  ) {
    const where: Prisma.LeadWhereInput = {
      tenantId,
      AND: words.map((word) => {
        const match = { contains: word.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
        return { OR: [{ displayName: match }, { websiteUrl: match }, { sourceName: match }] };
      }),
    };
    const direction = sort?.direction === 'ASC' ? 'asc' : 'desc';
    const order: Prisma.LeadOrderByWithRelationInput =
      sort?.field === 'DISPLAY_NAME'
        ? { displayName: { sort: direction, nulls: 'last' } }
        : { createdAt: direction };
    const client = this.database.client;
    const [items, total] = await client.$transaction(
      [
        client.lead.findMany({ where, skip: offset, take: limit, orderBy: [order, { id: 'asc' }] }),
        client.lead.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find({ tenantId }: SalesScope, id: string) {
    return this.database.client.lead.findUnique({ where: { tenantId_id: { tenantId, id } } });
  }

  create({ tenantId, userId }: SalesScope, fields: LeadFields) {
    return this.database.client.lead.create({
      data: { tenantId, ...fields, createdByUserId: userId },
    });
  }

  update({ tenantId }: SalesScope, id: string, fields: LeadFields) {
    return this.database.client.lead.update({
      where: { tenantId_id: { tenantId, id } },
      data: fields,
    });
  }
}
