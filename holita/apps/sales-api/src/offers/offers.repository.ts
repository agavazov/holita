import { Injectable } from '@nestjs/common';
import { searchText } from '../contacts/contact-search.js';
import { DatabaseService } from '../database.service.js';
import type { Prisma, SalesOfferStatus } from '../generated/prisma/client.js';
import { salesDate } from '../sales-date.js';
import type { SalesScope } from '../scope.js';

type OfferFields = Omit<
  Prisma.SalesOfferUncheckedCreateInput,
  | 'id'
  | 'tenantId'
  | 'leadId'
  | 'authorUserId'
  | 'status'
  | 'preparedAt'
  | 'manuallySentAt'
  | 'createdAt'
  | 'updatedAt'
>;

type OfferState = Pick<Prisma.SalesOfferUncheckedCreateInput, 'preparedAt' | 'manuallySentAt'> & {
  status: SalesOfferStatus;
};

type OfferList = {
  offset: number;
  limit: number;
  words: string[];
  leadId: string | undefined;
  status: SalesOfferStatus | undefined;
  expiresFrom: Date | undefined;
};

export function expiringSalesOffersWhere(reference: Date): Prisma.SalesOfferWhereInput {
  const today = new Date(salesDate(reference));
  const last = new Date(today);
  last.setUTCDate(last.getUTCDate() + 7);
  return { status: 'MANUALLY_SENT', validUntil: { gte: today, lte: last } };
}

@Injectable()
export class OffersRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    { tenantId, userId }: SalesScope,
    { offset, limit, words, leadId, status, expiresFrom }: OfferList,
  ) {
    const search = words.map((word) => {
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
    });
    const where: Prisma.SalesOfferWhereInput = {
      tenantId,
      authorUserId: userId,
      ...(leadId ? { leadId } : {}),
      ...(status ? { status } : {}),
      AND: expiresFrom ? [...search, expiringSalesOffersWhere(expiresFrom)] : search,
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
      where: { id, tenantId, authorUserId: userId, status: { in: ['DRAFT', 'PREPARED'] } },
      data: { ...data, status: 'DRAFT', preparedAt: null },
    });
  }

  transition(
    { tenantId, userId }: SalesScope,
    id: string,
    from: SalesOfferStatus,
    data: OfferState,
  ) {
    return this.database.client.salesOffer.update({
      where: { id, tenantId, authorUserId: userId, status: from },
      data,
    });
  }
}
