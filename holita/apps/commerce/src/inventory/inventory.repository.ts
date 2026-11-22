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

@Injectable()
export class InventoryRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    filter?: InventoryFilter | null,
    sort?: InventorySort | null,
  ) {
    const terms = words.map((word): Prisma.ProductVariantWhereInput => {
      const match = { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' } as const;
      return { OR: [{ product: { name: match } }, { sku: match }] };
    });
    const tracking = filter?.inventoryTracked;
    const where: Prisma.ProductVariantWhereInput = {
      ...scope,
      product: scope,
      ...(tracking == null ? {} : { inventoryTracked: tracking }),
      AND: [...terms, ...(filter?.outOfStock ? [{ inventoryTracked: true, quantity: 0 }] : [])],
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.ProductVariantOrderByWithRelationInput =
      sort?.field === 'SKU'
        ? { sku: direction }
        : sort?.field === 'QUANTITY'
          ? { quantity: direction }
          : { product: { name: direction } };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.productVariant.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          select: variantFields(scope),
        }),
        this.database.client.productVariant.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
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
