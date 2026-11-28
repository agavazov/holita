import { Injectable } from '@nestjs/common';
import { searchText } from '../contacts/contact-search.js';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';

type OfferFields = Omit<
  Prisma.SalesOfferUncheckedCreateInput,
  'id' | 'tenantId' | 'leadId' | 'authorUserId' | 'status' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class OffersRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    { tenantId, userId }: SalesScope,
    offset: number,
    limit: number,
    words: string[],
    leadId?: string,
  ) {
    const where: Prisma.SalesOfferWhereInput = {
      tenantId,
      authorUserId: userId,
      ...(leadId ? { leadId } : {}),
      AND: words.map((word) => {
        const match = searchText(word);
        return {
          OR: [
            { recipientName: match },
            { recipientEmail: match },
            { currentSiteUrl: match },
            { proposedSiteUrl: match },
            { recommendedPlanName: match },
            { alternativePlanName: match },
          ],
        };
      }),
    };
    const { salesOffer } = this.database.client;
    const [items, total] = await this.database.client.$transaction([
      salesOffer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      salesOffer.count({ where }),
    ]);
    return { items, total, offset, limit };
  }

  find({ tenantId, userId }: SalesScope, id: string) {
    return this.database.client.salesOffer.findUnique({
      where: { id, tenantId, authorUserId: userId },
    });
  }

  create({ tenantId, userId }: SalesScope, leadId: string | null, fields: OfferFields) {
    return this.database.client.salesOffer.create({
      data: { ...fields, tenantId, leadId, authorUserId: userId },
    });
  }

  update({ tenantId, userId }: SalesScope, id: string, data: OfferFields) {
    return this.database.client.salesOffer.update({
      where: { id, tenantId, authorUserId: userId, status: 'DRAFT' },
      data,
    });
  }
}
