import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  QuerySalesOffersArgs,
  SalesOffer,
  SalesOfferInput,
} from '../generated/graphql/types.js';
import { Prisma, type SalesOffer as StoredOffer } from '../generated/prisma/client.js';
import { activityId, activityWriteError } from '../leads/lead-activity-input.js';
import type { SalesScope } from '../scope.js';
import { offerFields } from './offer-input.js';
import { OffersRepository } from './offers.repository.js';

function present({
  recommendedPlanName,
  recommendedMonthlyPrice,
  alternativePlanName,
  alternativeMonthlyPrice,
  validUntil,
  createdAt,
  updatedAt,
  ...fields
}: StoredOffer): SalesOffer {
  return {
    ...fields,
    validUntil: validUntil?.toISOString().slice(0, 10) ?? null,
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

  async list(scope: SalesScope, { offset = 0, limit = 20, search, leadId }: QuerySalesOffersArgs) {
    const term = (search ?? '').trim();
    const words = term.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(
      scope,
      offset,
      limit,
      words,
      leadId == null ? undefined : activityId(leadId, 'offer'),
    );
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
    try {
      return present(
        await this.repository.update(scope, activityId(id, 'offer'), offerFields(input)),
      );
    } catch (error: unknown) {
      return activityWriteError(error, 'Draft offer not found');
    }
  }
}
