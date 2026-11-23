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
import {
  checkoutError,
  CheckoutService,
  invalidValue,
  validateOrderContact,
} from '../checkout/checkout.service.js';
import { checkoutCurrency } from '../checkout/currency.js';
import { ShopperRepository } from '../customers/shopper.repository.js';
import { DiscountsService } from '../discounts/discounts.service.js';
import type {
  OrderConfirmation,
  PlaceOrderInput,
  QueryShopperOrdersArgs,
  ShopperOrderPage,
} from '../generated/graphql/storefront-types.js';
import type {
  ManualOrderInput,
  ManualOrderUpdateInput,
  MutationUpdateOrderStatusArgs,
  Order as OperatorOrder,
  OrderPage,
  QueryOrdersArgs,
} from '../generated/graphql/types.js';
import type { Order, OrderLine, OrderStatus, Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope, type ShopperScope } from '../scope.js';
import {
  manualLineInputs,
  manualOrderId,
  orderLineSnapshot,
  reviseOrderLines,
} from './manual-order-lines.js';
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

function canEditManualOrder(order: Order): boolean {
  return order.cartId === null && order.status === 'PLACED' && order.paymentStatus === 'UNPAID';
}

function orderIdentity() {
  const id = randomUUID();
  return { id, orderNumber: `H-${id}`, placedAt: new Date() };
}

function orderContactFields({ contact, shippingAddress }: ReturnType<typeof validateOrderContact>) {
  return {
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    shippingCountryCode: shippingAddress.countryCode,
    shippingCity: shippingAddress.city,
    shippingPostalCode: shippingAddress.postalCode,
    shippingLine1: shippingAddress.line1,
    shippingLine2: shippingAddress.line2,
  };
}

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

function presentLine({ sku, label, quantity, unitPrice }: OrderLine) {
  return {
    sku,
    label,
    quantity,
    unitPrice: unitPrice.toFixed(2),
    lineTotal: new CartPrice(unitPrice).mul(quantity).toFixed(2),
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
    lines: order.lines.map(presentLine),
    subtotal: order.subtotal.toFixed(2),
    discountCode: order.discountCode,
    discountAmount: order.discountAmount.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
  };
}

function canMarkPaid(order: Order): boolean {
  return order.status !== 'CANCELLED' && order.paymentStatus === 'UNPAID';
}

function operatorDetail(order: OrderDetailRow): OperatorOrder {
  return {
    ...confirmation(order),
    invoice: order.invoice,
    paidAt: order.paidAt?.toISOString() ?? null,
    canEditManualOrder: canEditManualOrder(order),
    customerId: order.customerId,
    merchantNote: order.merchantNote,
    paymentMethodId: order.paymentMethodId,
    shippingMethodId: order.shippingMethodId,
    lines: order.lines.map((line) => ({
      ...presentLine(line),
      id: line.id,
      variantId: line.variantId,
    })),
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
    private readonly customers: ShopperRepository,
    private readonly discounts: DiscountsService,
  ) {}

  async operatorOrders(
    context: RequestContext,
    { offset = 0, limit = 20, search: rawSearch, status, customerId }: QueryOrdersArgs,
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
    if (customerId != null && !isUUID(customerId)) {
      throw invalidValue('customerId');
    }
    const page = await this.orders.operatorOrders(
      scope,
      offset,
      limit,
      words,
      status,
      customerId?.toLowerCase(),
    );
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

  async manualMethods(context: RequestContext) {
    const scope = await requireScope(context, false);
    return this.orders.transaction((tx) => this.checkout.enabledMethods(tx, scope));
  }

  async createManual(context: RequestContext, input: ManualOrderInput): Promise<OperatorOrder> {
    const scope = await requireScope(context, true);
    return this.orders.transaction(async (tx) => {
      const { data, revised } = await this.manualChanges(tx, scope, input, null);
      if (!revised) {
        throw invalidValue('lines');
      }
      const order = await this.orders.create(
        tx,
        scope,
        {
          ...orderIdentity(),
          ...data,
          subtotal: revised.subtotal,
          total: revised.subtotal.plus(data.shippingFee),
        },
        revised.lines,
      );
      return operatorDetail(order);
    });
  }

  async updateManual(
    context: RequestContext,
    id: string,
    input: ManualOrderUpdateInput,
  ): Promise<OperatorOrder> {
    const scope = await requireScope(context, true);
    return this.orders.transaction(async (tx) => {
      const order = await this.requireLockedOrder(tx, scope, id);
      if (!canEditManualOrder(order)) {
        throw checkoutError('order', 'MANUAL_ORDER_NOT_EDITABLE', 'This order cannot be edited');
      }
      if (
        order.invoice &&
        (input.lines !== undefined ||
          (input.shippingMethodId !== undefined &&
            input.shippingMethodId?.toLowerCase() !== order.shippingMethodId))
      ) {
        throw checkoutError(
          'order',
          'MANUAL_ORDER_AMOUNTS_LOCKED',
          'An invoice has been issued. Order items and the shipping charge are locked',
        );
      }
      const {
        data: { shippingFee, ...fields },
        revised,
      } = await this.manualChanges(tx, scope, input, order);
      const subtotal = revised?.subtotal ?? order.subtotal;
      const updated = await this.orders.updateManual(
        tx,
        scope,
        order.id,
        {
          ...fields,
          ...(!order.invoice && {
            shippingFee,
            subtotal,
            total: new CartPrice(subtotal).plus(shippingFee),
          }),
        },
        revised?.lines,
      );
      return operatorDetail(updated);
    });
  }

  private async manualChanges(
    tx: Prisma.TransactionClient,
    scope: Scope,
    input: ManualOrderUpdateInput,
    order: Order | null,
  ) {
    const contact = orderContactFields(validateOrderContact(input));
    const customerId =
      input.customerId === undefined
        ? (order?.customerId ?? null)
        : input.customerId === null
          ? null
          : manualOrderId(input.customerId, 'customerId');
    if (customerId && !(await this.customers.findById(tx, scope, customerId))) {
      throw checkoutError(
        'customerId',
        'ORDER_CUSTOMER_UNAVAILABLE',
        'Choose a customer from this shop',
      );
    }
    const merchantNote =
      input.merchantNote === undefined ? order?.merchantNote : input.merchantNote?.trim();
    if (merchantNote?.includes('\u0000')) {
      throw invalidValue('merchantNote');
    }

    const paymentMethodId =
      input.paymentMethodId === undefined
        ? order?.paymentMethodId
        : this.checkout.paymentMethodId(input.paymentMethodId ?? '');
    const shippingMethodId =
      input.shippingMethodId === undefined
        ? order?.shippingMethodId
        : this.checkout.shippingMethodId(input.shippingMethodId ?? '');
    if (!paymentMethodId || !shippingMethodId) {
      throw invalidValue(!paymentMethodId ? 'paymentMethodId' : 'shippingMethodId');
    }
    const payment =
      order?.paymentMethodId === paymentMethodId
        ? { label: order.paymentMethodLabel, instructions: order.paymentInstructions }
        : await this.checkout.paymentMethod(tx, scope, paymentMethodId);
    const shipping =
      order?.shippingMethodId === shippingMethodId
        ? { label: order.shippingMethodLabel, fixedFee: order.shippingFee }
        : await this.checkout.shippingMethod(tx, scope, shippingMethodId);

    if (input.lines === null) {
      throw invalidValue('lines');
    }
    const revised =
      input.lines === undefined
        ? undefined
        : await this.reviseLines(tx, scope, order?.id ?? null, input.lines);
    return {
      data: {
        ...contact,
        customerId,
        merchantNote: merchantNote || null,
        currency: order?.currency ?? checkoutCurrency,
        paymentMethodId,
        paymentMethodLabel: payment.label,
        paymentInstructions: payment.instructions,
        shippingMethodId,
        shippingMethodLabel: shipping.label,
        shippingFee: shipping.fixedFee,
      },
      revised,
    };
  }

  private async reviseLines(
    tx: Prisma.TransactionClient,
    scope: Scope,
    orderId: string | null,
    lines: NonNullable<ManualOrderUpdateInput['lines']>,
  ) {
    const inputs = manualLineInputs(lines);
    const newIds = inputs.flatMap(({ variantId }) => variantId ?? []);
    await this.orders.lockOrderProducts(tx, scope, orderId, newIds);
    // A product edit may have detached a line while this transaction waited for the product lock.
    const saved = orderId ? await this.orders.lines(tx, scope, orderId) : [];
    const ids = [...new Set([...newIds, ...saved.flatMap(({ variantId }) => variantId ?? [])])];
    const sellable = await this.cartRepository.publicVariants(tx, scope, ids);
    const revised = reviseOrderLines(inputs, saved, sellable);
    for (const [id, { quantity, path }] of revised.stockDeltas) {
      if (quantity > 0 && !(await this.orders.decrementStock(tx, scope, id, quantity))) {
        throw checkoutError(path, 'ORDER_STOCK_SHORT', 'Requested stock is no longer available');
      }
      if (quantity < 0) {
        await this.orders.incrementStock(tx, scope, id, -quantity);
      }
    }
    return revised;
  }

  async restockLockedRefund(tx: Prisma.TransactionClient, scope: Scope, order: OrderDetailRow) {
    if (order.status === 'SHIPPED' || order.status === 'COMPLETED') {
      await this.orders.restoreStock(tx, scope, order.id);
    } else if (order.status !== 'CANCELLED') {
      await this.changeLockedStatus(tx, scope, order, 'CANCELLED');
    }
  }

  async updateStatus(
    context: RequestContext,
    { id, status }: MutationUpdateOrderStatusArgs,
  ): Promise<OperatorOrder> {
    const scope = await requireScope(context, true);
    return this.orders.transaction(async (tx) => {
      const order = await this.requireLockedOrder(tx, scope, id);
      return operatorDetail(await this.changeLockedStatus(tx, scope, order, status));
    });
  }

  async changeLockedStatus(
    tx: Prisma.TransactionClient,
    scope: Scope,
    order: OrderDetailRow,
    status: OrderStatus,
  ) {
    if (order.status === status) {
      return order;
    }
    if (!nextStatuses[order.status].includes(status)) {
      throw statusRejected();
    }
    if (status === 'CANCELLED') {
      await this.orders.restoreStock(tx, scope, order.id);
    }
    return this.orders.updateStatus(tx, scope, order.id, {
      fromStatus: order.status,
      toStatus: status,
      occurredAt: new Date(),
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

  async requireLockedOrder(tx: Prisma.TransactionClient, scope: Scope, id: string) {
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

  async guestConfirmation(context: CartContext, cartId: string): Promise<OrderConfirmation | null> {
    const owner = cartOwner(context);
    if (!owner || !('guestTokenHash' in owner) || !isUUID(cartId)) {
      return null;
    }
    const order = await this.orders.findGuestConfirmationForCart(
      context.scope,
      cartId.toLowerCase(),
      owner.guestTokenHash,
    );
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
      const { id: cartId, discountId } = storedCart;
      if (storedCart.consumedAt) {
        const order = await this.orders.findForCart(tx, scope, cartId, customerId ?? null);
        if (!order) {
          throw cartMissing();
        }
        return confirmation(order);
      }

      await this.orders.lockProducts(tx, scope, cartId);
      if (discountId) {
        // The fresh read under this lock serializes the final use across carts and merchant edits.
        await this.discounts.lock(tx, scope, discountId);
      }
      const { cart, variants } = await this.carts.snapshot(tx, scope, storedCart);
      if (cart.lines.some(({ issue }) => issue === 'INSUFFICIENT_STOCK')) {
        throw stockChanged();
      }
      const { quote, contact, shippingAddress } = await this.checkout.quoteCart(
        tx,
        scope,
        { ...storedCart, cart },
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
          ...orderLineSnapshot(variant, line.optionLabels),
          sortOrder,
          quantity: line.quantity,
          stockDeductedQuantity: variant.inventoryTracked ? line.quantity : 0,
        });
      }

      const identity = orderIdentity();
      const order = await this.orders.create(
        tx,
        scope,
        {
          ...identity,
          cartId,
          customerId: customerId ?? null,
          ...orderContactFields({ contact, shippingAddress }),
          paymentMethodLabel: quote.paymentMethod.label,
          paymentInstructions: quote.paymentMethod.instructions,
          shippingMethodLabel: quote.shippingMethod.label,
          currency: quote.currency,
          subtotal: quote.subtotal,
          discountCode: quote.discountCode ?? null,
          discountAmount: quote.discountAmount,
          shippingFee: quote.shippingFee,
          total: quote.total,
        },
        lines,
      );
      if (discountId) {
        await this.discounts.redeem(tx, scope, discountId);
      }
      await this.cartRepository.consume(tx, scope, cartId, identity.placedAt);
      return confirmation(order);
    });
  }
}
