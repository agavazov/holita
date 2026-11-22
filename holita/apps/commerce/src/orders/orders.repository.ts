import { Injectable } from '@nestjs/common';
import type { CartOwner } from '../cart/cart.repository.js';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

function orderLines(scope: Scope) {
  return { where: scope, orderBy: { sortOrder: 'asc' } } satisfies Prisma.Order$linesArgs;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  findConfirmation(scope: Scope, id: string, owner: CartOwner) {
    const ownership =
      'customerId' in owner
        ? { customerId: owner.customerId }
        : { customerId: null, cart: { ...scope, ...owner, consumedAt: { not: null } } };
    return this.database.client.order.findUnique({
      where: { ...scope, id, ...ownership },
      include: { lines: orderLines(scope) },
    });
  }

  findForCart(
    tx: Prisma.TransactionClient,
    scope: Scope,
    cartId: string,
    customerId: string | null,
  ) {
    return tx.order.findUnique({
      where: { tenantId_branchId_cartId: { ...scope, cartId }, customerId },
      include: { lines: orderLines(scope) },
    });
  }

  async lockProducts(tx: Prisma.TransactionClient, scope: Scope, cartId: string) {
    // Inventory writes and product edits take the same parent lock before writing variants.
    await tx.$queryRaw`
      SELECT p."id" FROM ${this.database.table('product')} AS p
      WHERE p."tenantId" = ${scope.tenantId}::uuid AND p."branchId" = ${scope.branchId}::uuid
        AND EXISTS (
          SELECT 1 FROM ${this.database.table('cartLine')} AS line
          JOIN ${this.database.table('productVariant')} AS v
            ON v."tenantId" = line."tenantId" AND v."branchId" = line."branchId"
            AND v."id" = line."variantId"
          WHERE line."tenantId" = p."tenantId" AND line."branchId" = p."branchId"
            AND line."cartId" = ${cartId}::uuid AND v."productId" = p."id"
        )
      ORDER BY p."id"
      FOR UPDATE
    `;
  }

  async decrementStock(tx: Prisma.TransactionClient, scope: Scope, id: string, quantity: number) {
    const { count } = await tx.productVariant.updateMany({
      where: { ...scope, id, inventoryTracked: true, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    return count === 1;
  }

  create(
    tx: Prisma.TransactionClient,
    scope: Scope,
    order: Omit<Prisma.OrderUncheckedCreateInput, keyof Scope | 'lines'>,
    lines: Prisma.OrderLineCreateManyOrderInput[],
  ) {
    return tx.order.create({
      data: { ...scope, ...order, lines: { createMany: { data: lines } } },
      include: { lines: orderLines(scope) },
    });
  }
}
