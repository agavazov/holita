import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ProductCollectionInput, ProductCollectionSort } from '../generated/graphql/types.js';
import type { Scope } from '../scope.js';

type CollectionFields = Pick<ProductCollectionInput, 'name' | 'slug' | 'active' | 'mode'> & {
  categoryId: string | null;
  brandId: string | null;
};

const identity = { id: true, name: true, slug: true };
const summary = { ...identity, active: true, mode: true };

function manualItems(scope: Scope) {
  return {
    where: scope,
    orderBy: { sortOrder: 'asc' },
    select: { product: { select: { id: true, name: true, status: true } } },
  } satisfies Prisma.ProductCollection$itemsArgs;
}

export class InvalidCollectionReferenceError extends Error {
  constructor(readonly field: 'categoryId' | 'brandId' | 'productIds') {
    super('Collection membership references a record outside this shop');
  }
}

@Injectable()
export class CollectionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: ProductCollectionSort | null,
  ) {
    const where: Prisma.ProductCollectionWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { slug: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.ProductCollectionOrderByWithRelationInput =
      sort?.field === 'SLUG'
        ? { slug: direction }
        : sort?.field === 'ACTIVE'
          ? { active: direction }
          : { name: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.productCollection.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          select: summary,
        }),
        this.database.client.productCollection.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find(scope: Scope, id: string) {
    return this.database.client.productCollection.findUnique({
      where: { ...scope, id },
      include: { items: manualItems(scope) },
    });
  }

  save(scope: Scope, id: string | undefined, fields: CollectionFields, productIds: string[]) {
    return this.database.client.$transaction(async (tx) => {
      if (
        fields.categoryId &&
        !(await tx.category.findUnique({
          where: { ...scope, id: fields.categoryId },
          select: { id: true },
        }))
      ) {
        throw new InvalidCollectionReferenceError('categoryId');
      }
      if (
        fields.brandId &&
        !(await tx.brand.findUnique({
          where: { ...scope, id: fields.brandId },
          select: { id: true },
        }))
      ) {
        throw new InvalidCollectionReferenceError('brandId');
      }
      if (
        productIds.length &&
        (await tx.product.count({
          where: { ...scope, id: { in: productIds } },
        })) !== productIds.length
      ) {
        throw new InvalidCollectionReferenceError('productIds');
      }

      const collection = id
        ? await tx.productCollection.update({ where: { ...scope, id }, data: fields })
        : await tx.productCollection.create({ data: { ...scope, ...fields } });
      const itemScope = { ...scope, collectionId: collection.id };
      if (id) {
        await tx.productCollectionItem.deleteMany({ where: itemScope });
      }
      if (productIds.length) {
        await tx.productCollectionItem.createMany({
          data: productIds.map((productId, sortOrder) => ({ ...itemScope, productId, sortOrder })),
        });
      }
      return tx.productCollection.findUniqueOrThrow({
        where: { ...scope, id: collection.id },
        include: { items: manualItems(scope) },
      });
    });
  }

  async publicList(scope: Scope, offset: number, limit: number) {
    const where = { ...scope, active: true };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.productCollection.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: identity,
        }),
        this.database.client.productCollection.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }
}
