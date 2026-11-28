import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { ShopPageFilter, ShopPageInput, ShopPageSort } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';
import { policyPages, policySlugs } from './policy-pages.js';

@Injectable()
export class PagesRepository {
  constructor(private readonly database: DatabaseService) {}

  async ensurePolicyPages(scope: Scope): Promise<void> {
    const pages = this.database.client.shopPage;
    const existing = await pages.count({ where: { ...scope, slug: { in: policySlugs } } });
    if (existing < policyPages.length) {
      await pages.createMany({
        data: policyPages.map((page) => ({ ...scope, ...page })),
        skipDuplicates: true,
      });
    }
  }

  publishedPolicies(scope: Scope) {
    return this.database.client.shopPage.findMany({
      where: { ...scope, slug: { in: policySlugs }, status: 'PUBLISHED' },
      select: { id: true, slug: true },
    });
  }

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: ShopPageSort | null,
    filter?: ShopPageFilter | null,
  ) {
    const where: Prisma.ShopPageWhereInput = {
      ...scope,
      ...(filter?.statuses?.length ? { status: { in: filter.statuses } } : {}),
      AND: words.map((word) => ({
        OR: [
          { slug: { contains: word, mode: 'insensitive' } },
          { titleBg: { contains: word, mode: 'insensitive' } },
          { titleEn: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const direction = sort?.direction === 'ASC' ? 'asc' : 'desc';
    const order: Prisma.ShopPageOrderByWithRelationInput =
      sort?.field === 'SLUG'
        ? { slug: direction }
        : sort?.field === 'STATUS'
          ? { status: direction }
          : { updatedAt: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.shopPage.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
        }),
        this.database.client.shopPage.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find(scope: Scope, id: string) {
    return this.database.client.shopPage.findUnique({ where: { ...scope, id } });
  }

  published(scope: Scope, slug: string) {
    return this.database.client.shopPage.findUnique({
      where: { tenantId_branchId_slug: { ...scope, slug }, status: 'PUBLISHED' },
      select: { slug: true, titleBg: true, titleEn: true, bodyBg: true, bodyEn: true },
    });
  }

  create(scope: Scope, fields: ShopPageInput) {
    return this.database.client.shopPage.create({ data: { ...scope, ...fields } });
  }

  update(scope: Scope, id: string, data: ShopPageInput) {
    return this.database.client.shopPage.update({ where: { ...scope, id }, data });
  }
}
