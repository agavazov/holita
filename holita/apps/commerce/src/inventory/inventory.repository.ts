import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { InventoryFilter, InventorySort } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

function variantFields(scope: Scope) {
  return {
    id: true,
    productId: true,
    product: { select: { name: true } },
    sku: true,
    inventoryTracked: true,
    quantity: true,
    values: {
      where: { ...scope, optionValue: { ...scope, option: scope } },
      orderBy: [{ optionValue: { option: { name: 'asc' } } }, { optionValueId: 'asc' }],
      select: { optionValue: { select: { label: true, option: { select: { name: true } } } } },
    },
  } satisfies Prisma.ProductVariantSelect;
}

async function categoryTreeIds(tx: Prisma.TransactionClient, scope: Scope, id: string) {
  const categories = await tx.category.findMany({
    where: scope,
    select: { id: true, parentId: true },
  });
  const children = new Map<string | null, string[]>();
  for (const category of categories) {
    const siblings = children.get(category.parentId) ?? [];
    siblings.push(category.id);
    children.set(category.parentId, siblings);
  }
  const ids = new Set([id]);
  for (const parentId of ids) {
    for (const childId of children.get(parentId) ?? []) {
      ids.add(childId);
    }
  }
  return [...ids];
}

async function characteristicFilters(
  tx: Prisma.TransactionClient,
  scope: Scope,
  ids: string[],
): Promise<Prisma.ProductWhereInput[]> {
  const choices = { ...scope, id: { in: ids } };
  const fields = await tx.characteristic.findMany({
    where: {
      ...scope,
      active: true,
      kind: { not: 'TEXT' },
      group: { ...scope, active: true },
      choices: { some: choices },
    },
    select: {
      id: true,
      choices: { where: choices, select: { id: true } },
      group: { select: { categories: { where: scope, select: { categoryId: true } } } },
    },
  });
  if (fields.flatMap((field) => field.choices).length !== ids.length) {
    return [{ id: { in: [] } }];
  }
  return fields.map((field) => ({
    ...(field.group.categories.length
      ? { categoryId: { in: field.group.categories.map(({ categoryId }) => categoryId) } }
      : {}),
    characteristicChoices: {
      some: {
        ...scope,
        characteristicId: field.id,
        choiceId: { in: field.choices.map(({ id }) => id) },
      },
    },
  }));
}

function escapePattern(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&');
}

function exactBarcode(value: string): Prisma.ProductVariantWhereInput {
  return { barcode: { equals: escapePattern(value), mode: 'insensitive' } };
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    scope: Scope,
    offset: number,
    limit: number,
    search: string,
    filter: InventoryFilter,
    sort?: InventorySort | null,
  ) {
    const words = search.split(/\s+/u).filter(Boolean);
    const terms =
      Array.from(search).length > 200 || words.length > 5
        ? [exactBarcode(search)]
        : words.map((word): Prisma.ProductVariantWhereInput => {
            const match = { contains: escapePattern(word), mode: 'insensitive' } as const;
            return { OR: [{ product: { name: match } }, { sku: match }, { barcode: match }] };
          });
    const {
      inventoryTracked,
      outOfStock,
      brandId,
      categoryId,
      productActive,
      variantActive,
      barcode,
      stockStatus,
      characteristicChoiceIds,
    } = filter;
    if (barcode) {
      terms.push(exactBarcode(barcode));
    }
    if (outOfStock) {
      terms.push({ inventoryTracked: true, quantity: 0 });
    }
    if (stockStatus) {
      terms.push({
        inventoryTracked: true,
        quantity: stockStatus === 'IN_STOCK' ? { gt: 0 } : { lte: 0 },
      });
    }
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.ProductVariantOrderByWithRelationInput =
      sort?.field === 'SKU'
        ? { sku: direction }
        : sort?.field === 'QUANTITY'
          ? { quantity: direction }
          : { product: { name: direction } };
    return this.database.client.$transaction(
      async (tx) => {
        const categoryIds = categoryId ? await categoryTreeIds(tx, scope, categoryId) : undefined;
        const specifications = characteristicChoiceIds?.length
          ? await characteristicFilters(tx, scope, characteristicChoiceIds)
          : [];
        const where: Prisma.ProductVariantWhereInput = {
          ...scope,
          product: {
            ...scope,
            ...(brandId ? { brandId } : {}),
            ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
            ...(productActive == null
              ? {}
              : { status: productActive ? 'ACTIVE' : { not: 'ACTIVE' } }),
            AND: specifications,
          },
          ...(inventoryTracked == null ? {} : { inventoryTracked }),
          ...(variantActive == null ? {} : { active: variantActive }),
          AND: terms,
        };
        const items = await tx.productVariant.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          select: variantFields(scope),
        });
        const total = await tx.productVariant.count({ where });
        return { items, total, offset, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  find(scope: Scope, id: string) {
    return this.database.client.productVariant.findUnique({
      where: { ...scope, id, product: scope },
      select: variantFields(scope),
    });
  }

  updateQuantity(scope: Scope, id: string, quantity: number) {
    const where = { ...scope, id, product: scope };
    return this.database.client.$transaction(
      async (tx) => {
        const target = await tx.productVariant.findUnique({ where, select: { productId: true } });
        if (!target) {
          return { kind: 'missing' } as const;
        }
        // Product saves lock this parent before replacing the variant rows.
        await tx.$queryRaw`
          SELECT "id" FROM ${this.database.table('product')}
          WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
            AND "id" = ${target.productId}::uuid
          FOR UPDATE
        `;
        const current = await tx.productVariant.findUnique({
          where: { ...where, productId: target.productId },
          select: { inventoryTracked: true },
        });
        if (!current) {
          return { kind: 'missing' } as const;
        }
        if (!current.inventoryTracked) {
          return { kind: 'untracked' } as const;
        }
        const row = await tx.productVariant.update({
          where: { ...where, productId: target.productId },
          data: { quantity },
          select: variantFields(scope),
        });
        return { kind: 'updated', row } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
