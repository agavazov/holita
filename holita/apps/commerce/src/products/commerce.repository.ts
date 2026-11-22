import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import type {
  ProductInput,
  ProductSort,
  ProductFilter,
  ProductCharacteristicValueInput,
} from '../generated/graphql/types.js';
import type { Scope } from '../scope.js';
import { CharacteristicsRepository } from '../characteristics/characteristics.repository.js';
import { DatabaseService } from '../database.service.js';
import type { ProductImageWrite } from './product-images.js';
import {
  catalogueProductRelations,
  catalogueProductWhere,
  catalogueVariantValues,
  productRelations,
} from './product-relations.js';

type ProductFields = Omit<
  ProductInput,
  'variants' | 'images' | 'characteristicValues' | 'badgeIds' | 'tagIds'
>;
interface ProductMarkerIds {
  badgeIds: string[] | undefined;
  tagIds: string[] | undefined;
}
interface VariantWrite {
  id?: string;
  sku: string;
  price: string;
  quantity: number | undefined;
  inventoryTracked: boolean;
  active: boolean;
  combinationKey: string;
  sortOrder: number;
  optionValueIds: string[];
}

function listRelations(scope: Scope) {
  return { ...productRelations(scope), brand: true } satisfies Prisma.ProductInclude;
}

@Injectable()
export class CommerceRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly characteristics: CharacteristicsRepository,
  ) {}

  async products(
    scope: Scope,
    offset: number,
    limit: number,
    search: string[],
    filter: ProductFilter | null | undefined,
    sort: ProductSort | null | undefined,
  ) {
    const where: Prisma.ProductWhereInput = {
      ...scope,
      AND: search.map((word) => ({ name: { contains: word, mode: 'insensitive' } })),
      ...(filter?.statuses ? { status: { in: filter.statuses } } : {}),
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
                include: listRelations(scope),
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
    const result = await tx.$queryRaw`
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
    if (!Array.isArray(result)) {
      throw new Error('Invalid price-sort result');
    }
    const ids = result.map((row: unknown) => {
      if (
        typeof row !== 'object' ||
        row === null ||
        !('id' in row) ||
        typeof row.id !== 'string' ||
        !isUUID(row.id)
      ) {
        throw new Error('Invalid product ID in price-sort result');
      }
      return row.id;
    });
    const rows = await tx.product.findMany({
      where: { ...scope, id: { in: ids } },
      include: listRelations(scope),
    });
    const indexed = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => indexed.get(id) ?? []);
  }

  product(scope: Scope, id: string) {
    return this.database.client.product.findUnique({
      where: { id, ...scope },
      include: productRelations(scope),
    });
  }

  publicProduct(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) =>
        tx.product.findUnique({
          where: { id, ...catalogueProductWhere(scope) },
          include: catalogueProductRelations(scope),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  publicProductVariantSelections(scope: Scope, ids: string[]) {
    return this.database.client.$transaction(
      (tx) =>
        tx.product.findMany({
          where: { ...catalogueProductWhere(scope), id: { in: ids } },
          select: {
            id: true,
            variants: {
              where: { ...scope, active: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                sku: true,
                price: true,
                quantity: true,
                inventoryTracked: true,
                values: catalogueVariantValues(scope),
              },
            },
          },
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  image(scope: Scope, storageKey: string, publicOnly: boolean) {
    return this.database.client.productImage.findFirst({
      where: {
        ...scope,
        storageKey,
        ...(publicOnly ? { product: catalogueProductWhere(scope) } : {}),
      },
      select: { id: true },
    });
  }

  optionValues(scope: Scope, ids: string[]) {
    return this.database.client.optionValue.findMany({
      where: { ...scope, id: { in: ids } },
      select: { id: true, optionId: true },
    });
  }

  save(
    scope: Scope,
    id: string | undefined,
    input: ProductFields,
    variants: VariantWrite[],
    images: ProductImageWrite[] | undefined,
    characteristicValues: ProductCharacteristicValueInput[],
    { badgeIds, tagIds }: ProductMarkerIds,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const product = id
        ? await tx.product.update({ where: { id, ...scope }, data: input })
        : await tx.product.create({ data: { ...scope, ...input } });
      const productScope = { ...scope, productId: product.id };
      const current = id
        ? await tx.productVariant.findMany({
            where: productScope,
            select: { id: true, quantity: true },
          })
        : [];
      const quantities = new Map(current.map((variant) => [variant.id, variant.quantity]));
      const replacements = variants.map((variant, index) => {
        if (!variant.id) {
          return { ...variant, quantity: variant.quantity ?? 0 };
        }
        const quantity = quantities.get(variant.id);
        if (quantity === undefined) {
          throw new InvalidVariantIdError(index);
        }
        if (variant.quantity !== undefined && variant.quantity !== quantity) {
          throw new ConflictingVariantQuantityError(index);
        }
        return { ...variant, quantity };
      });
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
      const retainedIds = new Set(replacements.map((variant) => variant.id));
      const removedIds = current.map((variant) => variant.id).filter((id) => !retainedIds.has(id));
      if (removedIds.length) {
        await tx.cartLine.updateMany({
          where: { ...scope, variantId: { in: removedIds } },
          data: { variantId: null },
        });
      }
      // Replace the aggregate atomically, keeping the IDs of retained variants.
      // This also permits exchanging a SKU or combination between rows in one edit.
      await tx.productVariant.deleteMany({ where: productScope });
      for (const { optionValueIds, ...variant } of replacements) {
        await tx.productVariant.create({
          data: {
            ...productScope,
            ...variant,
            values: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
          },
        });
      }
      if (characteristicValues.length) {
        await this.characteristics.patchProductValues(tx, productScope, characteristicValues);
      }
      if (badgeIds) {
        await this.replaceBadgeAssignments(tx, productScope, badgeIds);
      }
      if (tagIds) {
        await this.replaceTagAssignments(tx, productScope, tagIds);
      }
      const retiredKeys = images ? await this.replaceImages(tx, productScope, images) : [];
      const row = await tx.product.findUniqueOrThrow({
        where: { ...scope, id: product.id },
        include: productRelations(scope),
      });
      return { row, retiredKeys };
    });
  }

  private async replaceBadgeAssignments(
    tx: Prisma.TransactionClient,
    productScope: Scope & { productId: string },
    badgeIds: string[],
  ) {
    const { tenantId, branchId } = productScope;
    if (
      badgeIds.length &&
      (await tx.productBadge.count({ where: { tenantId, branchId, id: { in: badgeIds } } })) !==
        badgeIds.length
    ) {
      throw new InvalidMarkerIdError('badgeIds');
    }
    await tx.productBadgeAssignment.deleteMany({ where: productScope });
    if (badgeIds.length) {
      await tx.productBadgeAssignment.createMany({
        data: badgeIds.map((badgeId) => ({ ...productScope, badgeId })),
      });
    }
  }

  private async replaceTagAssignments(
    tx: Prisma.TransactionClient,
    productScope: Scope & { productId: string },
    tagIds: string[],
  ) {
    const { tenantId, branchId } = productScope;
    if (
      tagIds.length &&
      (await tx.productTag.count({ where: { tenantId, branchId, id: { in: tagIds } } })) !==
        tagIds.length
    ) {
      throw new InvalidMarkerIdError('tagIds');
    }
    await tx.productTagAssignment.deleteMany({ where: productScope });
    if (tagIds.length) {
      await tx.productTagAssignment.createMany({
        data: tagIds.map((tagId) => ({ ...productScope, tagId })),
      });
    }
  }

  private async replaceImages(
    tx: Prisma.TransactionClient,
    where: Scope & { productId: string },
    images: ProductImageWrite[],
  ) {
    const current = await tx.productImage.findMany({
      where,
      select: { id: true, storageKey: true },
    });
    const retained = new Map(current.map(({ id, storageKey }) => [id, storageKey]));
    for (const image of images) {
      if ('id' in image && !retained.delete(image.id)) {
        throw new InvalidImageIdError(image.sortOrder);
      }
    }
    if (retained.size) {
      await tx.productImage.deleteMany({ where: { ...where, id: { in: [...retained.keys()] } } });
    }
    for (const image of images) {
      if ('id' in image) {
        const { id, ...data } = image;
        await tx.productImage.update({ where: { ...where, id }, data });
      } else {
        await tx.productImage.create({ data: { ...where, ...image } });
      }
    }
    return [...retained.values()];
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

export class ConflictingVariantQuantityError extends Error {
  constructor(readonly index: number) {
    super('Use Inventory to adjust quantities for tracked variants');
  }
}

export class InvalidImageIdError extends Error {
  constructor(readonly index: number) {
    super('Choose an image from this product');
  }
}

export class InvalidMarkerIdError extends Error {
  constructor(readonly field: 'badgeIds' | 'tagIds') {
    super('Product marker is outside this shop');
  }
}
