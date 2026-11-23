import { Injectable } from '@nestjs/common';
import { normalizeContactPhone } from '../contacts/contact-phone.js';
import { contactWordMatches, searchText } from '../contacts/contact-search.js';
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
    term: string,
    words: string[],
    sort?: LeadSort | null,
  ) {
    const perWord = words.map((word) => {
      const match = searchText(word);
      return {
        OR: [
          { displayName: match },
          { websiteUrl: match },
          { sourceName: match },
          { contacts: { some: { tenantId, OR: contactWordMatches(word) } } },
        ],
      };
    });
    const phone = normalizeContactPhone(term);
    const where: Prisma.LeadWhereInput = {
      tenantId,
      ...(phone
        ? { OR: [{ AND: perWord }, { contacts: { some: { tenantId, phone } } }] }
        : { AND: perWord }),
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
