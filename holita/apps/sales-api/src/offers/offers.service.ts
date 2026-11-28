import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  QuerySalesOffersArgs,
  SalesOffer,
  SalesOfferAction,
  SalesOfferInput,
} from '../generated/graphql/types.js';
import { Prisma, type SalesOffer as StoredOffer } from '../generated/prisma/client.js';
import { activityId } from '../leads/lead-activity-input.js';
import type { SalesScope } from '../scope.js';
import { offerFields } from './offer-input.js';
import { OffersRepository } from './offers.repository.js';

function present({
  recommendedPlanName,
  recommendedMonthlyPrice,
  alternativePlanName,
  alternativeMonthlyPrice,
  validUntil,
  preparedAt,
  manuallySentAt,
  createdAt,
  updatedAt,
  ...fields
}: StoredOffer): SalesOffer {
  return {
    ...fields,
    validUntil: validUntil?.toISOString().slice(0, 10) ?? null,
    preparedAt: preparedAt?.toISOString() ?? null,
    manuallySentAt: manuallySentAt?.toISOString() ?? null,
    recommended:
      recommendedPlanName && recommendedMonthlyPrice
        ? { planName: recommendedPlanName, monthlyPrice: recommendedMonthlyPrice.toFixed(2) }
        : null,
    alternative:
      alternativePlanName && alternativeMonthlyPrice
        ? { planName: alternativePlanName, monthlyPrice: alternativeMonthlyPrice.toFixed(2) }
        : null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

@Injectable()
export class OffersService {
  constructor(private readonly repository: OffersRepository) {}

  async list(
    scope: SalesScope,
    { offset = 0, limit = 20, search, leadId, status, expires }: QuerySalesOffersArgs,
  ) {
    const term = (search ?? '').trim();
    const words = term.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(scope, {
      offset,
      limit,
      words,
      leadId: leadId == null ? undefined : activityId(leadId, 'offer'),
      status: status ?? undefined,
      expiresFrom: expires === 'WITHIN_7_DAYS' ? new Date() : undefined,
    });
    return { ...page, items: page.items.map(present) };
  }

  async find(scope: SalesScope, id: string) {
    const row = await this.repository.find(scope, activityId(id, 'offer'));
    return row ? present(row) : null;
  }

  async create(scope: SalesScope, leadId: string | null, input: SalesOfferInput) {
    try {
      return present(
        await this.repository.create(
          scope,
          leadId === null ? null : activityId(leadId, 'offer'),
          offerFields(input),
        ),
      );
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException('Lead not found');
      }
      throw error;
    }
  }

  async update(scope: SalesScope, id: string, input: SalesOfferInput) {
    const offerId = activityId(id, 'offer');
    try {
      return present(await this.repository.update(scope, offerId, offerFields(input)));
    } catch (error: unknown) {
      return this.writeError(error, scope, offerId, 'Clear manually sent status before editing');
    }
  }

  async transition(scope: SalesScope, id: string, action: SalesOfferAction) {
    const offerId = activityId(id, 'offer');
    const now = new Date();
    try {
      switch (action) {
        case 'PREPARE':
          return present(
            await this.repository.transition(scope, offerId, 'DRAFT', {
              status: 'PREPARED',
              preparedAt: now,
            }),
          );
        case 'MARK_MANUALLY_SENT':
          return present(
            await this.repository.transition(scope, offerId, 'PREPARED', {
              status: 'MANUALLY_SENT',
              manuallySentAt: now,
            }),
          );
        case 'CLEAR_MANUALLY_SENT':
          return present(
            await this.repository.transition(scope, offerId, 'MANUALLY_SENT', {
              status: 'PREPARED',
              manuallySentAt: null,
            }),
          );
      }
    } catch (error: unknown) {
      return this.writeError(error, scope, offerId, 'Offer is not in the required state');
    }
  }

  private async writeError(
    error: unknown,
    scope: SalesScope,
    id: string,
    message: string,
  ): Promise<never> {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      if (await this.repository.find(scope, id)) {
        throw new ConflictException(message);
      }
      throw new NotFoundException('Offer not found');
    }
    throw error;
  }
}
