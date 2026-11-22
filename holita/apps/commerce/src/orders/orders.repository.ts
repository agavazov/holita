import { Injectable } from '@nestjs/common';
import type { CartOwner } from '../cart/cart.repository.js';
import { DatabaseService } from '../database.service.js';
import { Prisma, type OrderStatus } from '../generated/prisma/client.js';
import type { Scope, ShopperScope } from '../scope.js';

function orderLines(scope: Scope) {
  return {
    where: scope,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  } satisfies Prisma.Order$linesArgs;
}

function orderDetail(scope: Scope) {
  return {
    lines: orderLines(scope),
    invoice: { select: { id: true, number: true } },
    statusChanges: { where: scope, orderBy: { id: 'asc' } },
  } satisfies Prisma.OrderInclude;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  async operatorOrders(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    status?: OrderStatus | null,
  ) {
    const where: Prisma.OrderWhereInput = {
      ...scope,
      ...(status ? { status } : {}),
      AND: words.map((word) => {
        const match = { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' } as const;
        return {
          OR: [
            { orderNumber: match },
            { contactName: match },
            { contactEmail: match },
            { contactPhone: match },
          ],
        };
      }),
    };
    const order = this.database.client.order;
    const [items, total] = await this.database.client.$transaction(
      [
        order.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            orderNumber: true,
            placedAt: true,
            status: true,
            paymentStatus: true,
            contactName: true,
            total: true,
            currency: true,
          },
        }),
        order.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  operatorOrder(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) => tx.order.findUnique({ where: { ...scope, id }, include: orderDetail(scope) }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async lockOrder(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    await tx.$queryRaw`
      SELECT "id" FROM ${this.database.table('order')}
      WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
        AND "id" = ${id}::uuid
      FOR UPDATE
    `;
    return tx.order.findUnique({ where: { ...scope, id }, include: orderDetail(scope) });
  }

  updateStatus(
    tx: Prisma.TransactionClient,
    scope: Scope,
    id: string,
    change: Prisma.OrderStatusChangeCreateWithoutOrderInput,
  ) {
    return tx.order.update({
      where: { ...scope, id },
      data: { status: change.toStatus, statusChanges: { create: change } },
      include: orderDetail(scope),
    });
  }

  markPaid(tx: Prisma.TransactionClient, scope: Scope, id: string, paidAt: Date) {
    return tx.order.update({
      where: { ...scope, id },
      data: { paymentStatus: 'PAID', paidAt },
      include: orderDetail(scope),
    });
  }

  async restoreStock(tx: Prisma.TransactionClient, scope: Scope, orderId: string) {
    // Product saves may replace retained variants or detach removed ones under this parent lock.
    await tx.$queryRaw`
      SELECT p."id" FROM ${this.database.table('product')} AS p
      WHERE p."tenantId" = ${scope.tenantId}::uuid AND p."branchId" = ${scope.branchId}::uuid
        AND EXISTS (
          SELECT 1 FROM ${this.database.table('orderLine')} AS line
          JOIN ${this.database.table('productVariant')} AS v
            ON v."tenantId" = line."tenantId" AND v."branchId" = line."branchId"
            AND v."id" = line."variantId"
          WHERE line."tenantId" = p."tenantId" AND line."branchId" = p."branchId"
            AND line."orderId" = ${orderId}::uuid AND line."stockDecremented"
            AND v."productId" = p."id"
        )
      ORDER BY p."id"
      FOR UPDATE
    `;
    const deductions = await tx.orderLine.groupBy({
      by: ['variantId'],
      where: { ...scope, orderId, stockDecremented: true, variantId: { not: null } },
      _sum: { quantity: true },
    });
    for (const { variantId, _sum } of deductions) {
      if (variantId !== null && _sum.quantity !== null) {
        await tx.productVariant.updateMany({
          where: { ...scope, id: variantId },
          data: { quantity: { increment: _sum.quantity } },
        });
      }
    }
  }

  async shopperOrders(scope: ShopperScope, offset: number, limit: number) {
    const order = this.database.client.order;
    const [items, total] = await this.database.client.$transaction(
      [
        order.findMany({
          where: scope,
          skip: offset,
          take: limit,
          orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            orderNumber: true,
            placedAt: true,
            status: true,
            paymentStatus: true,
            shippingMethodLabel: true,
            paymentMethodLabel: true,
            total: true,
            currency: true,
          },
        }),
        order.count({ where: scope }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  shopperOrder(scope: ShopperScope, id: string) {
    const { tenantId, branchId } = scope;
    return this.database.client.order.findUnique({
      where: { ...scope, id },
      include: { lines: orderLines({ tenantId, branchId }) },
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
