import { Injectable } from '@nestjs/common';
import { Prisma } from './generated/prisma/client.js';
import type { ProductInput, ProductSort, ProductFilter } from './generated/graphql/types.js';
import type { Scope } from './scope.js';
import { DatabaseService } from './database.service.js';

type ProductFields = Omit<ProductInput, 'variants'>;
interface VariantWrite {
  id?: string;
  sku: string;
  price: string;
  quantity: number;
  inventoryTracked: boolean;
  active: boolean;
  combinationKey: string;
  sortOrder: number;
  optionValueIds: string[];
}

const available = { some: { active: true } } satisfies Prisma.ProductVariantListRelationFilter;

function listRelations(scope: Scope, publicOnly: boolean) {
  return {
    brand: true,
    variants: {
      ...withVariants(scope).variants,
      ...(publicOnly
        ? { where: { ...scope, active: true }, orderBy: { price: 'asc' }, take: 1 }
        : {}),
    },
  } satisfies Prisma.ProductInclude;
}

function withVariants(scope: Scope) {
  return {
    variants: {
      where: scope,
      orderBy: { sortOrder: 'asc' },
      include: { values: { where: scope, select: { optionValueId: true } } },
    },
  } satisfies Prisma.ProductInclude;
}

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
    publicOnly = false,
  ) {
    const where: Prisma.ProductWhereInput = {
      ...scope,
      AND: search.map((word) => ({ name: { contains: word, mode: 'insensitive' } })),
      ...(filter?.statuses ? { status: { in: filter.statuses } } : {}),
      ...(publicOnly ? { variants: available } : {}),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.ProductOrderByWithRelationInput =
      sort?.field === 'STATUS'
        ? { status: direction }
        : sort?.field === 'CREATED_AT'
          ? { createdAt: direction }
          : { name: direction };
    return this.database.client.$transaction(
      async (tx) => {
        const items =
          sort?.field === 'PRICE'
            ? await this.productsByPrice(tx, scope, offset, limit, search, filter, direction)
            : await tx.product.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: [order, { id: 'desc' }],
                include: listRelations(scope, publicOnly),
              });
        return { items, total: await tx.product.count({ where }), offset, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async productsByPrice(
    tx: Prisma.TransactionClient,
    scope: Scope,
    offset: number,
    limit: number,
    search: string[],
    filter: ProductFilter | null | undefined,
    direction: 'asc' | 'desc',
  ) {
    const conditions = [
      Prisma.sql`p."tenantId" = ${scope.tenantId}::uuid`,
      Prisma.sql`p."branchId" = ${scope.branchId}::uuid`,
      ...search.map((word) => Prisma.sql`p."name" ILIKE ${'%' + word + '%'}`),
    ];
    if (filter?.statuses) {
      conditions.push(
        Prisma.sql`p."status"::text IN (${Prisma.join(filter.statuses.map((status) => status.toLowerCase()))})`,
      );
    }
    const order = direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const keys = await tx.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM ${this.database.table('product')} AS p
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY (
        SELECT MIN(v."price") FROM ${this.database.table('productVariant')} AS v
        WHERE v."tenantId" = p."tenantId" AND v."branchId" = p."branchId"
          AND v."productId" = p."id" AND v."active"
      ) ${order} NULLS LAST, p."id" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await tx.product.findMany({
      where: { ...scope, id: { in: keys.map(({ id }) => id) } },
      include: listRelations(scope, false),
    });
    const indexed = new Map(rows.map((row) => [row.id, row]));
    return keys.flatMap(({ id }) => indexed.get(id) ?? []);
  }

  product(scope: Scope, id: string) {
    return this.database.client.product.findUnique({
      where: { id, ...scope },
      include: withVariants(scope),
    });
  }

  publicProduct(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) =>
        tx.product.findUnique({
          where: { id, ...scope, status: 'ACTIVE', variants: available },
          include: listRelations(scope, true),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  optionValues(scope: Scope, ids: string[]) {
    return this.database.client.optionValue.findMany({
      where: { ...scope, id: { in: ids } },
      select: { id: true, optionId: true },
    });
  }

  save(scope: Scope, id: string | undefined, input: ProductFields, variants: VariantWrite[]) {
    return this.database.client.$transaction(async (tx) => {
      const product = id
        ? await tx.product.update({ where: { id, ...scope }, data: input })
        : await tx.product.create({ data: { ...scope, ...input } });
      const productScope = { ...scope, productId: product.id };
      if (id) {
        const current = await tx.productVariant.findMany({
          where: productScope,
          select: { id: true },
        });
        const ids = new Set(current.map((variant) => variant.id));
        const invalidIdIndex = variants.findIndex((variant) => variant.id && !ids.has(variant.id));
        if (invalidIdIndex !== -1) {
          throw new InvalidVariantIdError(invalidIdIndex);
        }
      }
      const conflicting = await tx.productVariant.findFirst({
        where: {
          ...scope,
          productId: { not: product.id },
          sku: { in: variants.map(({ sku }) => sku) },
        },
        select: { sku: true },
      });
      if (conflicting) {
        // Roll back the product write as well.
        throw new DuplicateSkuError(conflicting.sku);
      }
      // Replace the aggregate atomically, keeping the IDs of retained variants.
      // This also permits exchanging a SKU or combination between rows in one edit.
      await tx.productVariant.deleteMany({ where: productScope });
      for (const { optionValueIds, ...variant } of variants) {
        await tx.productVariant.create({
          data: {
            ...productScope,
            ...variant,
            values: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
          },
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { ...scope, id: product.id },
        include: withVariants(scope),
      });
    });
  }

  customers(scope: Scope) {
    return this.database.client.customer.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }, { id: 'desc' }],
    });
  }
}

export class DuplicateSkuError extends Error {
  constructor(readonly sku: string) {
    super('This shop already uses the SKU');
  }
}

export class InvalidVariantIdError extends Error {
  constructor(readonly index: number) {
    super('Choose a variant from this product');
  }
}
