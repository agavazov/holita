import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { randomUUID } from 'node:crypto';
import { CartRepository } from '../cart/cart.repository.js';
import {
  cartMissing,
  cartOwner,
  CartPrice,
  CartService,
  type CartContext,
} from '../cart/cart.service.js';
import { checkoutError, CheckoutService } from '../checkout/checkout.service.js';
import type {
  OrderConfirmation,
  PlaceOrderInput,
  QueryShopperOrdersArgs,
  ShopperOrderPage,
} from '../generated/graphql/storefront-types.js';
import type {
  MutationUpdateOrderStatusArgs,
  Order as OperatorOrder,
  OrderPage,
  QueryOrdersArgs,
} from '../generated/graphql/types.js';
import type { Order, OrderLine, OrderStatus, Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope, type ShopperScope } from '../scope.js';
import { OrdersRepository } from './orders.repository.js';

type ShopperOrderRow = Awaited<ReturnType<OrdersRepository['shopperOrders']>>['items'][number];
type OrderSummaryRow = Pick<
  Order,
  'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'placedAt' | 'currency' | 'total'
>;
type OrderDetailRow = NonNullable<Awaited<ReturnType<OrdersRepository['operatorOrder']>>>;

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function summary(order: OrderSummaryRow) {
  return {
    id: order.id,
    number: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    placedAt: order.placedAt.toISOString(),
    currency: order.currency,
    total: order.total.toFixed(2),
  };
}

function shopperSummary(order: ShopperOrderRow) {
  return {
    ...summary(order),
    paymentMethodLabel: order.paymentMethodLabel,
    shippingMethodLabel: order.shippingMethodLabel,
  };
}

function confirmation(order: Order & { lines: OrderLine[] }) {
  return {
    ...shopperSummary(order),
    contact: { name: order.contactName, email: order.contactEmail, phone: order.contactPhone },
    shippingAddress: {
      countryCode: order.shippingCountryCode,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
    },
    paymentInstructions: order.paymentInstructions,
    lines: order.lines.map(({ sku, label, quantity, unitPrice }) => ({
      sku,
      label,
      quantity,
      unitPrice: unitPrice.toFixed(2),
      lineTotal: new CartPrice(unitPrice).mul(quantity).toFixed(2),
    })),
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
  };
}

function canMarkPaid(order: Order): boolean {
  return order.status !== 'CANCELLED' && order.paymentStatus === 'UNPAID';
}

function operatorDetail(order: OrderDetailRow): OperatorOrder {
  return {
    ...confirmation(order),
    paidAt: order.paidAt?.toISOString() ?? null,
    statusChanges: order.statusChanges.map(({ fromStatus, toStatus, occurredAt }) => ({
      fromStatus,
      toStatus,
      occurredAt: occurredAt.toISOString(),
    })),
    nextStatuses: nextStatuses[order.status],
    canMarkPaid: canMarkPaid(order),
  };
}

function statusRejected() {
  const message = 'This order cannot move to the selected status';
  return new GraphQLError(message, {
    extensions: {
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: 'status', code: 'ORDER_STATUS_REJECTED', message }],
    },
  });
}

function paymentRejected() {
  const message = 'Payment cannot be recorded for this order';
  return new GraphQLError(message, {
    extensions: {
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: 'paymentStatus', code: 'ORDER_PAYMENT_REJECTED', message }],
    },
  });
}

function stockChanged() {
  return checkoutError('cart', 'CHECKOUT_STOCK_CHANGED', 'Requested stock is no longer available');
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly cartRepository: CartRepository,
    private readonly carts: CartService,
    private readonly checkout: CheckoutService,
  ) {}

  async operatorOrders(
    context: RequestContext,
    { offset = 0, limit = 20, search: rawSearch, status }: QueryOrdersArgs,
  ): Promise<OrderPage> {
    const scope = await requireScope(context, false);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const search = (rawSearch ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.orders.operatorOrders(scope, offset, limit, words, status);
    return {
      ...page,
      items: page.items.map((order) => ({ ...summary(order), contactName: order.contactName })),
    };
  }

  async operatorOrder(context: RequestContext, id: string): Promise<OperatorOrder | null> {
    const scope = await requireScope(context, false);
    if (!isUUID(id)) {
      return null;
    }
    const order = await this.orders.operatorOrder(scope, id.toLowerCase());
    return order ? operatorDetail(order) : null;
  }

  async updateStatus(
    context: RequestContext,
    { id, status }: MutationUpdateOrderStatusArgs,
  ): Promise<OperatorOrder> {
    const scope = await requireScope(context, true);
    return this.orders.transaction(async (tx) => {
      const order = await this.requireLockedOrder(tx, scope, id);
      if (order.status === status) {
        return operatorDetail(order);
      }
      if (!nextStatuses[order.status].includes(status)) {
        throw statusRejected();
      }
      if (status === 'CANCELLED') {
        await this.orders.restoreStock(tx, scope, order.id);
      }
      return operatorDetail(
        await this.orders.updateStatus(tx, scope, order.id, {
          fromStatus: order.status,
          toStatus: status,
          occurredAt: new Date(),
        }),
      );
    });
  }

  async markPaid(context: RequestContext, id: string): Promise<OperatorOrder> {
    const scope = await requireScope(context, true);
    return this.orders.transaction(async (tx) => {
      const order = await this.requireLockedOrder(tx, scope, id);
      if (order.paymentStatus === 'PAID') {
        return operatorDetail(order);
      }
      if (!canMarkPaid(order)) {
        throw paymentRejected();
      }
      return operatorDetail(await this.orders.markPaid(tx, scope, order.id, new Date()));
    });
  }

  private async requireLockedOrder(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    const order = isUUID(id) ? await this.orders.lockOrder(tx, scope, id.toLowerCase()) : null;
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async shopperOrders(
    scope: ShopperScope,
    { offset = 0, limit = 20 }: QueryShopperOrdersArgs,
  ): Promise<ShopperOrderPage> {
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const page = await this.orders.shopperOrders(scope, offset, limit);
    return { ...page, items: page.items.map(shopperSummary) };
  }

  async shopperOrder(scope: ShopperScope, id: string): Promise<OrderConfirmation | null> {
    if (!isUUID(id)) {
      return null;
    }
    const order = await this.orders.shopperOrder(scope, id.toLowerCase());
    return order ? confirmation(order) : null;
  }

  async confirmation(context: CartContext, orderId: string): Promise<OrderConfirmation | null> {
    const owner = cartOwner(context);
    if (!owner || !isUUID(orderId)) {
      return null;
    }
    const order = await this.orders.findConfirmation(context.scope, orderId.toLowerCase(), owner);
    return order ? confirmation(order) : null;
  }

  place(context: CartContext, input: PlaceOrderInput): Promise<OrderConfirmation> {
    const { scope, customerId } = context;
    const owner = cartOwner(context);
    if (!owner || !isUUID(input.cartId)) {
      throw cartMissing();
    }
    return this.orders.transaction(async (tx) => {
      const storedCart = await this.cartRepository.lock(
        tx,
        scope,
        owner,
        input.cartId.toLowerCase(),
      );
      if (!storedCart) {
        throw cartMissing();
      }
      const cartId = storedCart.id;
      if (storedCart.consumedAt) {
        const order = await this.orders.findForCart(tx, scope, cartId, customerId ?? null);
        if (!order) {
          throw cartMissing();
        }
        return confirmation(order);
      }

      await this.orders.lockProducts(tx, scope, cartId);
      const { cart, variants } = await this.carts.snapshot(tx, scope, cartId);
      if (cart.lines.some(({ issue }) => issue === 'INSUFFICIENT_STOCK')) {
        throw stockChanged();
      }
      const { quote, contact, shippingAddress } = await this.checkout.quoteCart(
        tx,
        scope,
        { id: cartId, cart },
        input,
      );
      if (input.quoteRevision !== quote.quoteRevision) {
        throw checkoutError('cart', 'CHECKOUT_QUOTE_CHANGED', 'Review the updated checkout total');
      }

      const lines: Prisma.OrderLineCreateManyOrderInput[] = [];
      for (const [sortOrder, line] of quote.lines.entries()) {
        const variant = line.variantId ? variants.get(line.variantId) : undefined;
        if (!variant) {
          throw checkoutError('cart', 'CHECKOUT_CART_CHANGED', 'Review the cart before checkout');
        }
        if (
          variant.inventoryTracked &&
          !(await this.orders.decrementStock(tx, scope, variant.id, line.quantity))
        ) {
          throw stockChanged();
        }
        lines.push({
          variantId: variant.id,
          sortOrder,
          sku: variant.sku,
          label: [variant.product.name, ...line.optionLabels].join(' · '),
          quantity: line.quantity,
          unitPrice: variant.price,
          stockDecremented: variant.inventoryTracked,
        });
      }

      const id = randomUUID();
      const placedAt = new Date();
      const order = await this.orders.create(
        tx,
        scope,
        {
          id,
          cartId,
          customerId: customerId ?? null,
          orderNumber: `H-${id}`,
          placedAt,
          contactName: contact.name,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          shippingCountryCode: shippingAddress.countryCode,
          shippingCity: shippingAddress.city,
          shippingPostalCode: shippingAddress.postalCode,
          shippingLine1: shippingAddress.line1,
          shippingLine2: shippingAddress.line2,
          paymentMethodLabel: quote.paymentMethod.label,
          paymentInstructions: quote.paymentMethod.instructions,
          shippingMethodLabel: quote.shippingMethod.label,
          currency: quote.currency,
          subtotal: quote.subtotal,
          shippingFee: quote.shippingFee,
          total: quote.total,
        },
        lines,
      );
      await this.cartRepository.consume(tx, scope, cartId, placedAt);
      return confirmation(order);
    });
  }
}
