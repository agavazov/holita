import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { LeadContactSort } from '../generated/graphql/types.js';
import { Prisma, type LeadContact } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { normalizeContactPhone } from './contact-phone.js';
import { contactWordMatches, searchText } from './contact-search.js';

type ContactFields = Pick<LeadContact, 'name' | 'phone' | 'email' | 'role' | 'isPrimary' | 'notes'>;

@Injectable()
export class ContactsRepository {
  constructor(private readonly database: DatabaseService) {}

  listForLead({ tenantId }: SalesScope, leadId: string) {
    return this.database.client.leadContact.findMany({
      where: { tenantId, leadId },
      orderBy: [{ isPrimary: 'desc' }, { name: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
  }

  find({ tenantId }: SalesScope, leadId: string, id: string) {
    return this.database.client.leadContact.findUnique({ where: { tenantId, leadId, id } });
  }

  async list(
    { tenantId }: SalesScope,
    offset: number,
    limit: number,
    term: string,
    words: string[],
    sort?: LeadContactSort | null,
  ) {
    const perWord = words.map((word) => {
      const match = searchText(word);
      return {
        OR: [
          ...contactWordMatches(word),
          { lead: { tenantId, OR: [{ displayName: match }, { websiteUrl: match }] } },
        ],
      };
    });
    const phone = normalizeContactPhone(term);
    const where: Prisma.LeadContactWhereInput = {
      tenantId,
      lead: { tenantId },
      ...(phone ? { OR: [{ AND: perWord }, { phone }] } : { AND: perWord }),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.LeadContactOrderByWithRelationInput =
      sort?.field === 'UPDATED_AT'
        ? { updatedAt: direction }
        : { name: { sort: direction, nulls: 'last' } };
    const client = this.database.client;
    const [items, total] = await client.$transaction(
      [
        client.leadContact.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          include: { lead: { select: { id: true, displayName: true, websiteUrl: true } } },
        }),
        client.leadContact.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  save({ tenantId }: SalesScope, leadId: string, fields: ContactFields, id?: string) {
    return this.database.client.$transaction(async (tx) => {
      if (id === undefined) {
        const lead = await tx.lead.findUnique({
          where: { tenantId_id: { tenantId, id: leadId } },
          select: { id: true },
        });
        if (!lead) {
          return null;
        }
      }
      if (fields.isPrimary) {
        await tx.leadContact.updateMany({
          where: {
            tenantId,
            leadId,
            isPrimary: true,
            ...(id === undefined ? {} : { id: { not: id } }),
          },
          data: { isPrimary: false },
        });
      }
      return id === undefined
        ? tx.leadContact.create({ data: { tenantId, leadId, ...fields } })
        : tx.leadContact.update({ where: { id, tenantId, leadId }, data: fields });
    });
  }

  delete({ tenantId }: SalesScope, leadId: string, id: string) {
    return this.database.client.leadContact.delete({ where: { tenantId, leadId, id } });
  }
}
