import { Injectable } from '@nestjs/common';
import type { CartOwner } from '../cart/cart.repository.js';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
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

const guestConfirmationWindowMs = 24 * 60 * 60 * 1000;

function confirmationOwnership(scope: Scope, owner: CartOwner) {
  if ('customerId' in owner) {
    return { customerId: owner.customerId };
  }
  return {
    customerId: null,
    cart: {
      ...scope,
      guestTokenHash: owner.guestTokenHash,
      consumedAt: { gt: new Date(Date.now() - guestConfirmationWindowMs) },
    },
  } satisfies Prisma.OrderWhereInput;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  async notifications(scope: Scope, offset: number, limit: number) {
    const notification = this.database.client.orderNotification;
    const [items, total, unreadCount] = await this.database.client.$transaction(
      [
        notification.findMany({
          where: scope,
          skip: offset,
          take: limit,
          orderBy: [{ placedAt: 'desc' }, { orderId: 'desc' }],
          select: {
            orderId: true,
            placedAt: true,
            readAt: true,
            order: { select: { orderNumber: true } },
          },
        }),
        notification.count({ where: scope }),
        notification.count({ where: { ...scope, readAt: null } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit, unreadCount };
  }

  markNotificationsRead(scope: Scope, orderId?: string) {
    return this.database.client.orderNotification.updateMany({
      where: { ...scope, readAt: null, ...(orderId && { orderId }) },
      data: { readAt: new Date() },
    });
  }

  async operatorOrders(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    filters: Prisma.OrderWhereInput,
  ) {
    const where: Prisma.OrderWhereInput = {
      ...scope,
      AND: [
        filters,
        ...words.map((word) => {
          const match = {
            contains: word.replace(/[\\%_]/gu, '\\$&'),
            mode: 'insensitive',
          } as const;
          return {
            OR: [
              { orderNumber: match },
              { contactName: match },
              { contactEmail: match },
              { contactPhone: match },
            ],
          };
        }),
      ],
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

  async operatorFilterMethods(scope: Scope) {
    const { order, paymentMethod, shippingMethod } = this.database.client;
    const usedInShop = { ...scope, orders: { some: scope } };
    const [paymentMethods, shippingMethods, legacyPayments, legacyShipping] =
      await this.database.client.$transaction(
        [
          paymentMethod.findMany({
            where: usedInShop,
            select: { id: true, label: true },
            orderBy: [{ label: 'asc' }, { id: 'asc' }],
          }),
          shippingMethod.findMany({
            where: usedInShop,
            select: { id: true, label: true },
            orderBy: [{ label: 'asc' }, { id: 'asc' }],
          }),
          order.groupBy({
            where: { ...scope, paymentMethodId: null },
            by: ['paymentMethodLabel'],
            orderBy: { paymentMethodLabel: 'asc' },
          }),
          order.groupBy({
            where: { ...scope, shippingMethodId: null },
            by: ['shippingMethodLabel'],
            orderBy: { shippingMethodLabel: 'asc' },
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    return {
      paymentMethods,
      shippingMethods,
      paymentMethodLabels: legacyPayments.map(({ paymentMethodLabel }) => paymentMethodLabel),
      shippingMethodLabels: legacyShipping.map(({ shippingMethodLabel }) => shippingMethodLabel),
    };
  }

  operatorOrder(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) => tx.order.findUnique({ where: { ...scope, id }, include: orderDetail(scope) }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async manualVariants(scope: Scope, offset: number, limit: number, search: string) {
    const words = search.split(/\s+/u).filter(Boolean);
    const product = { ...scope, status: 'ACTIVE' } satisfies Prisma.ProductWhereInput;
    const select = {
      id: true,
      sku: true,
      minimumQuantity: true,
      product: { select: { name: true } },
      values: { where: scope, select: { optionValueId: true } },
    } satisfies Prisma.ProductVariantSelect;
    const page = await this.database.client.$transaction(
      async ({ productVariant }) => {
        const exact =
          search && Array.from(search).length <= 100
            ? await productVariant.findUnique({
                where: {
                  tenantId_branchId_sku: { ...scope, sku: search },
                  active: true,
                  product,
                },
                select,
              })
            : null;
        const first = exact && offset === 0 ? [exact] : [];
        if (words.length > 5) {
          return { items: first, total: exact ? 1 : 0 };
        }
        const where: Prisma.ProductVariantWhereInput = {
          ...scope,
          active: true,
          ...(exact && { id: { not: exact.id } }),
          product: {
            ...product,
            AND: words.map((word) => ({
              name: { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' },
            })),
          },
        };
        const take = limit - first.length;
        const matches = take
          ? await productVariant.findMany({
              where,
              skip: exact ? Math.max(0, offset - 1) : offset,
              take,
              orderBy: [
                { product: { name: 'asc' } },
                { productId: 'asc' },
                { sortOrder: 'asc' },
                { id: 'asc' },
              ],
              select,
            })
          : [];
        return {
          items: [...first, ...matches],
          total: (await productVariant.count({ where })) + (exact ? 1 : 0),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: page.items.map(({ id, sku, minimumQuantity, product: { name }, values }) => ({
        id,
        productName: name,
        sku,
        minimumQuantity,
        optionValueIds: values.map(({ optionValueId }) => optionValueId),
      })),
      total: page.total,
      offset,
      limit,
    };
  }

  async lockOrder(
    tx: Prisma.TransactionClient,
    { customerId, ...scope }: Scope & { customerId?: string },
    id: string,
  ) {
    const owner = customerId === undefined ? {} : { customerId };
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM ${this.database.table('order')}
      WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
        AND "id" = ${id}::uuid
        ${customerId === undefined ? Prisma.empty : Prisma.sql`AND "customerId" = ${customerId}::uuid`}
      FOR UPDATE
    `;
    if (locked.length === 0) {
      return null;
    }
    return tx.order.findUnique({ where: { ...scope, ...owner, id }, include: orderDetail(scope) });
  }

  async updateStatus(
    tx: Prisma.TransactionClient,
    scope: Scope,
    id: string,
    change: Pick<
      Prisma.OrderStatusChangeCreateWithoutOrderInput,
      'fromStatus' | 'toStatus' | 'occurredAt'
    >,
  ) {
    const event = await tx.orderStatusChange.create({ data: { ...scope, orderId: id, ...change } });
    const order = await tx.order.update({
      where: { ...scope, id },
      data: { status: change.toStatus },
      include: orderDetail(scope),
    });
    return { event, order };
  }

  markPaid(tx: Prisma.TransactionClient, scope: Scope, id: string, paidAt: Date) {
    return tx.order.update({
      where: { ...scope, id },
      data: { paymentStatus: 'PAID', paidAt },
      include: orderDetail(scope),
    });
  }

  async lockOrderProducts(
    tx: Prisma.TransactionClient,
    scope: Scope,
    orderId: string | null,
    variantIds: string[] = [],
  ) {
    const addedVariants = variantIds.length
      ? Prisma.sql`v."id" IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.sql`FALSE`;
    // Product saves may replace retained variants or detach removed ones under this parent lock.
    await tx.$queryRaw`
      SELECT p."id" FROM ${this.database.table('product')} AS p
      WHERE p."tenantId" = ${scope.tenantId}::uuid AND p."branchId" = ${scope.branchId}::uuid
        AND EXISTS (
          SELECT 1 FROM ${this.database.table('productVariant')} AS v
          WHERE v."tenantId" = p."tenantId" AND v."branchId" = p."branchId"
            AND v."productId" = p."id"
            AND (${addedVariants} OR EXISTS (
              SELECT 1 FROM ${this.database.table('orderLine')} AS line
              WHERE line."tenantId" = v."tenantId" AND line."branchId" = v."branchId"
                AND line."variantId" = v."id" AND line."orderId" = ${orderId}::uuid
            ))
        )
      ORDER BY p."id"
      FOR UPDATE
    `;
  }

  async restoreStock(tx: Prisma.TransactionClient, scope: Scope, orderId: string) {
    await this.lockOrderProducts(tx, scope, orderId);
    const deductions = await tx.orderLine.groupBy({
      by: ['variantId'],
      where: { ...scope, orderId, stockDeductedQuantity: { gt: 0 }, variantId: { not: null } },
      _sum: { stockDeductedQuantity: true },
    });
    for (const { variantId, _sum } of deductions) {
      if (variantId !== null && _sum.stockDeductedQuantity !== null) {
        await this.incrementStock(tx, scope, variantId, _sum.stockDeductedQuantity);
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
    return this.database.client.order.findUnique({
      where: { ...scope, id, ...confirmationOwnership(scope, owner) },
      include: { lines: orderLines(scope) },
    });
  }

  findConfirmationForCart(
    scope: Scope,
    cartId: string,
    owner: CartOwner,
    tx: Prisma.TransactionClient = this.database.client,
  ) {
    const ownership =
      'customerId' in owner
        ? { ...owner, cart: { ...scope, ...owner, consumedAt: { not: null } } }
        : confirmationOwnership(scope, owner);
    return tx.order.findUnique({
      where: {
        tenantId_branchId_cartId: { ...scope, cartId },
        ...ownership,
      },
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

  lines(tx: Prisma.TransactionClient, scope: Scope, orderId: string) {
    return tx.orderLine.findMany({ ...orderLines(scope), where: { ...scope, orderId } });
  }

  async returnReservations(tx: Prisma.TransactionClient, scope: Scope, orderId: string) {
    const cases = await tx.orderReturnCase.findMany({
      where: { ...scope, orderId },
      select: {
        reason: true,
        status: true,
        lines: {
          where: { ...scope, orderId },
          select: { orderLineId: true, quantity: true },
        },
      },
    });
    const quantities = new Map<string, number>();
    for (const { status, lines } of cases) {
      for (const { orderLineId, quantity } of lines) {
        // Rejected cases still reference their lines, but release the reserved units.
        quantities.set(
          orderLineId,
          (quantities.get(orderLineId) ?? 0) + (status === 'REJECTED' ? 0 : quantity),
        );
      }
    }
    return { cases, quantities };
  }

  incrementStock(tx: Prisma.TransactionClient, scope: Scope, id: string, quantity: number) {
    return tx.productVariant.updateMany({
      where: { ...scope, id },
      data: { quantity: { increment: quantity } },
    });
  }

  async updateManual(
    tx: Prisma.TransactionClient,
    scope: Scope,
    id: string,
    data: Omit<Prisma.OrderUncheckedUpdateInput, keyof Scope | 'id' | 'lines'>,
    lines?: Prisma.OrderLineCreateManyOrderInput[],
  ) {
    if (lines) {
      // The line position is unique per order. Reinsert the snapshots with their retained IDs.
      await tx.orderLine.deleteMany({ where: { ...scope, orderId: id } });
    }
    return tx.order.update({
      where: { ...scope, id },
      data: { ...data, ...(lines ? { lines: { createMany: { data: lines } } } : {}) },
      include: orderDetail(scope),
    });
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
    order: Omit<Prisma.OrderUncheckedCreateInput, keyof Scope | 'lines' | 'notification'>,
    lines: Prisma.OrderLineCreateManyOrderInput[],
  ) {
    return tx.order.create({
      data: {
        ...scope,
        ...order,
        lines: { createMany: { data: lines } },
        notification: { create: { placedAt: order.placedAt } },
      },
      include: orderDetail(scope),
    });
  }
}
