import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { ProductBadgeInput, ProductBadgeSort } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const identity = { id: true, name: true, slug: true, active: true, color: true, sortOrder: true };
const byName = [
  { name: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductBadgeOrderByWithRelationInput[];

function badgeOrder(sort?: ProductBadgeSort | null): Prisma.ProductBadgeOrderByWithRelationInput[] {
  const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
  switch (sort?.field) {
    case 'NAME':
      return [{ name: direction }, { id: 'asc' }];
    case 'ACTIVE':
      return [{ active: direction }, ...byName];
    default:
      return [{ sortOrder: direction }, ...byName];
  }
}

@Injectable()
export class BadgesRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: ProductBadgeSort | null,
  ) {
    const where: Prisma.ProductBadgeWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { slug: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.productBadge.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: badgeOrder(sort),
          select: identity,
        }),
        this.database.client.productBadge.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  choices(scope: Scope) {
    return this.database.client.productBadge.findMany({
      where: scope,
      orderBy: badgeOrder(),
      select: identity,
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.productBadge.findUnique({
      where: { ...scope, id },
      select: identity,
    });
  }

  save(scope: Scope, id: string | undefined, fields: ProductBadgeInput) {
    return id
      ? this.database.client.productBadge.update({
          where: { ...scope, id },
          data: fields,
          select: identity,
        })
      : this.database.client.productBadge.create({
          data: { ...scope, ...fields },
          select: identity,
        });
  }
}
