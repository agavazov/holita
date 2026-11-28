import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma, type ProductVariant } from '../generated/prisma/client.js';
import type {
  ProductInput,
  ProductSort,
  ProductFilter,
  ProductCharacteristicValueInput,
} from '../generated/graphql/types.js';
import type { Scope } from '../scope.js';
import { CartPrice } from '../cart/cart.service.js';
import { CharacteristicsRepository } from '../characteristics/characteristics.repository.js';
import { DatabaseService } from '../database.service.js';
import { coversWholeOrder } from '../returns/return-lines.js';
import type { ProductImageWrite } from './product-images.js';
import {
  catalogueProductRelations,
  catalogueProductWhere,
  catalogueVariantValues,
  productRelations,
} from './product-relations.js';
import { validateVariantOptions, VariantOptionValuesError } from './product-variant-options.js';

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
  barcode: string | null | undefined;
  price: string;
  weight: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
  depth: number | null | undefined;
  quantity: number | undefined;
  minimumQuantity: number | undefined;
  imageId: string | null | undefined;
  inventoryTracked: boolean;
  active: boolean;
  combinationKey: string;
  sortOrder: number;
  optionValueIds: string[];
}

type VariantPrice = Pick<ProductVariant, 'id' | 'price' | 'active'>;

function listRelations(scope: Scope) {
  return { ...productRelations(scope), brand: true } satisfies Prisma.ProductInclude;
}

const referencePriceWindowMs = 30 * 24 * 60 * 60 * 1000;

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
      async (tx) => {
        const now = new Date();
        const products = await tx.product.findMany({
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
                weight: true,
                width: true,
                height: true,
                depth: true,
                quantity: true,
                minimumQuantity: true,
                imageId: true,
                inventoryTracked: true,
                values: catalogueVariantValues(scope),
              },
            },
          },
        });
        const history = await tx.productVariantPriceHistory.groupBy({
          by: ['variantId'],
          where: {
            ...scope,
            variantId: { in: products.flatMap(({ variants }) => variants.map(({ id }) => id)) },
            recordedAt: { lte: now },
            OR: [
              { publicFrom: { lte: now }, publicUntil: null },
              { publicUntil: { gt: new Date(now.getTime() - referencePriceWindowMs) } },
            ],
          },
          _min: { price: true },
        });
        const referencePrices = new Map(
          history.map(({ variantId, _min }) => [variantId, _min.price]),
        );
        return products.map(({ id, variants }) => ({
          id,
          variants: variants.map((variant) => ({
            ...variant,
            referencePrice30Days: referencePrices.get(variant.id) ?? null,
          })),
        }));
      },
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
      const wasPublished = id ? await this.lockProductPublication(tx, scope, id) : false;
      const product = id
        ? await tx.product.update({ where: { id, ...scope }, data: input })
        : await tx.product.create({ data: { ...scope, ...input } });
      const productScope = { ...scope, productId: product.id };
      const current = id
        ? await tx.productVariant.findMany({
            where: productScope,
            select: {
              id: true,
              price: true,
              active: true,
              barcode: true,
              weight: true,
              width: true,
              height: true,
              depth: true,
              quantity: true,
              minimumQuantity: true,
              imageId: true,
              combinationKey: true,
            },
          })
        : [];
      const currentById = new Map(current.map((variant) => [variant.id, variant]));
      const replacements = variants.map((variant, index) => {
        if (!variant.id) {
          return {
            ...variant,
            barcode: variant.barcode ?? null,
            weight: variant.weight ?? null,
            width: variant.width ?? null,
            height: variant.height ?? null,
            depth: variant.depth ?? null,
            quantity: variant.quantity ?? 0,
            minimumQuantity: variant.minimumQuantity ?? 1,
          };
        }
        const existing = currentById.get(variant.id);
        if (!existing) {
          throw new InvalidVariantIdError(index);
        }
        if (variant.combinationKey !== existing.combinationKey) {
          throw new VariantOptionValuesError(
            index,
            'VARIANT_COMBINATION_IMMUTABLE',
            'Add a new variant for a different combination',
          );
        }
        if (variant.quantity !== undefined && variant.quantity !== existing.quantity) {
          throw new ConflictingVariantQuantityError(index);
        }
        return {
          ...variant,
          barcode: variant.barcode === undefined ? existing.barcode : variant.barcode,
          weight: variant.weight === undefined ? existing.weight : variant.weight,
          width: variant.width === undefined ? existing.width : variant.width,
          height: variant.height === undefined ? existing.height : variant.height,
          depth: variant.depth === undefined ? existing.depth : variant.depth,
          quantity: existing.quantity,
          minimumQuantity: variant.minimumQuantity ?? existing.minimumQuantity,
          imageId: variant.imageId === undefined ? existing.imageId : variant.imageId,
        };
      });
      const valueIds = [...new Set(replacements.flatMap((variant) => variant.optionValueIds))];
      const optionValues = valueIds.length
        ? await tx.optionValue.findMany({
            where: { ...scope, id: { in: valueIds } },
            select: { id: true, optionId: true },
          })
        : [];
      validateVariantOptions(replacements, optionValues);
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
        const protectedIds = await this.variantsWithOutstandingDeductions(tx, scope, removedIds);
        if (protectedIds.size) {
          throw new VariantOutstandingDeductionsError();
        }
        await tx.cartLine.updateMany({
          where: { ...scope, variantId: { in: removedIds } },
          data: { variantId: null },
        });
        await tx.orderLine.updateMany({
          where: { ...scope, variantId: { in: removedIds } },
          data: { variantId: null },
        });
      }
      // Replace the aggregate atomically, keeping the IDs of retained variants.
      // This also permits exchanging SKUs between rows in one edit.
      await tx.productVariant.deleteMany({ where: productScope });
      const retiredKeys = images ? await this.replaceImages(tx, productScope, images) : [];
      const referencedImageIds = replacements.flatMap(({ imageId }) => (imageId ? [imageId] : []));
      const retainedImages = new Set(
        referencedImageIds.length
          ? (
              await tx.productImage.findMany({
                where: { ...productScope, id: { in: referencedImageIds } },
                select: { id: true },
              })
            ).map(({ id }) => id)
          : [],
      );
      for (const [index, { optionValueIds, imageId, ...variant }] of replacements.entries()) {
        const retainedImageId = imageId && retainedImages.has(imageId) ? imageId : null;
        if (variants[index]?.imageId && !retainedImageId) {
          throw new InvalidVariantImageIdError(index);
        }
        try {
          await tx.productVariant.create({
            data: {
              ...productScope,
              ...variant,
              imageId: retainedImageId,
              values: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
            },
          });
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            error.message.includes('productVariant_shop_barcode_lower_key')
          ) {
            throw new DuplicateBarcodeError(index);
          }
          throw error;
        }
      }
      if (characteristicValues.length) {
        await this.characteristics.patchProductValues(
          tx,
          productScope,
          product.categoryId,
          characteristicValues,
        );
      }
      if (badgeIds) {
        await this.replaceBadgeAssignments(tx, productScope, badgeIds);
      }
      if (tagIds) {
        await this.replaceTagAssignments(tx, productScope, tagIds);
      }
      const row = await tx.product.findUniqueOrThrow({
        where: { ...scope, id: product.id },
        include: productRelations(scope),
      });
      await this.recordVariantPrices(
        tx,
        scope,
        currentById,
        row.variants,
        wasPublished,
        row.status === 'ACTIVE',
      );
      return { row, retiredKeys };
    });
  }

  private async lockProductPublication(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    const [product] = await tx.$queryRaw<{ published: boolean }[]>`
      SELECT "status" = 'active' AS "published" FROM ${this.database.table('product')}
      WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
        AND "id" = ${id}::uuid
      FOR UPDATE
    `;
    return product?.published === true;
  }

  private async recordVariantPrices(
    tx: Prisma.TransactionClient,
    scope: Scope,
    previous: ReadonlyMap<string, VariantPrice>,
    saved: VariantPrice[],
    wasPublished: boolean,
    published: boolean,
  ) {
    const recordedAt = new Date();
    const observations: Prisma.ProductVariantPriceHistoryCreateManyInput[] = [];
    const currentPublic = new Map<string, Prisma.Decimal>();
    for (const { id: variantId, price, active } of saved) {
      const isPublic = published && active;
      if (isPublic) {
        currentPublic.set(variantId, price);
      }
      const prior = previous.get(variantId);
      if (!prior || !prior.price.eq(price) || (wasPublished && prior.active) !== isPublic) {
        observations.push({
          ...scope,
          variantId,
          price,
          recordedAt,
          publicFrom: isPublic ? recordedAt : null,
        });
      }
    }
    const ending = [...previous.values()].filter(
      ({ id, price, active }) => wasPublished && active && !currentPublic.get(id)?.eq(price),
    );
    if (ending.length) {
      const closed = await tx.productVariantPriceHistory.updateManyAndReturn({
        where: {
          ...scope,
          variantId: { in: ending.map(({ id }) => id) },
          publicFrom: { not: null },
          publicUntil: null,
        },
        data: { publicUntil: recordedAt },
        select: { variantId: true },
      });
      const closedIds = new Set(closed.map(({ variantId }) => variantId));
      for (const { id: variantId, price } of ending) {
        if (!closedIds.has(variantId)) {
          // The previous public price is known at this transition. Its start is unknown.
          observations.push({ ...scope, variantId, price, recordedAt, publicUntil: recordedAt });
        }
      }
    }
    if (observations.length) {
      await tx.productVariantPriceHistory.createMany({ data: observations });
    }
  }

  private async variantsWithOutstandingDeductions(
    tx: Prisma.TransactionClient,
    scope: Scope,
    variantIds: string[],
  ) {
    const candidates = new Set(variantIds);
    const deduction = { ...scope, variantId: { in: variantIds }, stockDeductedQuantity: { gt: 0 } };
    const orders = await tx.order.findMany({
      where: { ...scope, status: { not: 'CANCELLED' }, lines: { some: deduction } },
      select: {
        status: true,
        total: true,
        lines: {
          where: scope,
          select: { id: true, quantity: true, variantId: true, stockDeductedQuantity: true },
        },
        refunds: { where: scope, select: { amount: true, restock: true } },
        returnCases: {
          where: { ...scope, status: 'APPROVED' },
          select: {
            completedAt: true,
            lines: { where: scope, select: { orderLineId: true, quantity: true } },
          },
        },
      },
    });
    const protectedIds = new Set<string>();
    for (const { status, total, lines, refunds, returnCases } of orders) {
      if (status === 'SHIPPED' || status === 'COMPLETED') {
        const fullReturn = returnCases.find((item) => coversWholeOrder(lines, item.lines));
        if (fullReturn?.completedAt || refunds.some(({ restock }) => restock)) {
          continue;
        }
        const refunded = refunds.reduce((sum, { amount }) => sum.plus(amount), new CartPrice(0));
        // A full approved return can still restore stock after the last refund.
        if (!fullReturn && total.lte(refunded)) {
          continue;
        }
      }
      for (const { variantId, stockDeductedQuantity } of lines) {
        if (variantId !== null && stockDeductedQuantity > 0 && candidates.has(variantId)) {
          protectedIds.add(variantId);
        }
      }
    }
    return protectedIds;
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

export class DuplicateBarcodeError extends Error {
  constructor(readonly index: number) {
    super('This shop already uses the barcode');
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

export class VariantOutstandingDeductionsError extends Error {
  constructor() {
    super('This variant still has stock to restore');
  }
}

export class InvalidImageIdError extends Error {
  constructor(readonly index: number) {
    super('Choose an image from this product');
  }
}

export class InvalidVariantImageIdError extends Error {
  constructor(readonly index: number) {
    super('Choose an image retained in this product gallery');
  }
}

export class InvalidMarkerIdError extends Error {
  constructor(readonly field: 'badgeIds' | 'tagIds') {
    super('Product marker is outside this shop');
  }
}
