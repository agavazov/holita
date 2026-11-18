import { Injectable } from '@nestjs/common';
import { Prisma } from './generated/prisma/client.js';
import type { ProductInput, ProductSort, ProductFilter } from './generated/graphql/types.js';
import type { Scope } from './scope.js';
import { DatabaseService } from './database.service.js';

@Injectable()
export class CommerceRepository {
  constructor(private readonly database: DatabaseService) {}

  async products(
    scope: Scope,
    offset: number,
    limit: number,
    search: string[],
    filter: ProductFilter | null | undefined,
    sort: ProductSort | null | undefined,
  ) {
    const conditions: Prisma.ProductWhereInput[] = search.map((word) => ({
      name: { contains: word, mode: 'insensitive' },
    }));
    for (const condition of filter?.allOf ?? []) {
      conditions.push({
        ...(condition.nameContains
          ? { name: { contains: condition.nameContains, mode: 'insensitive' } }
          : {}),
        ...(condition.statuses ? { status: { in: condition.statuses } } : {}),
        ...(condition.minimumPrice || condition.maximumPrice
          ? {
              price: {
                ...(condition.minimumPrice ? { gte: condition.minimumPrice } : {}),
                ...(condition.maximumPrice ? { lte: condition.maximumPrice } : {}),
              },
            }
          : {}),
      });
    }
    const where: Prisma.ProductWhereInput = {
      ...scope,
      ...(conditions.length ? { AND: conditions } : {}),
      ...(filter?.statuses ? { status: { in: filter.statuses } } : {}),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.ProductOrderByWithRelationInput =
      sort?.field === 'PRICE'
        ? { price: direction }
        : sort?.field === 'STATUS'
          ? { status: direction }
          : sort?.field === 'CREATED_AT'
            ? { createdAt: direction }
            : { name: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.product.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'desc' }],
        }),
        this.database.client.product.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  product(scope: Scope, id: string) {
    return this.database.client.product.findUnique({ where: { id, ...scope } });
  }

  create(scope: Scope, input: ProductInput) {
    return this.database.client.product.create({ data: { ...scope, ...input } });
  }

  update(scope: Scope, id: string, input: ProductInput) {
    return this.database.client.product.update({ where: { id, ...scope }, data: input });
  }

  customers(scope: Scope) {
    return this.database.client.customer.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }, { id: 'desc' }],
    });
  }
}
