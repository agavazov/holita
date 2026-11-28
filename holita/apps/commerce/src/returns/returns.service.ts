import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { contentInputError } from '../content-validation.js';
import type {
  ShopperReturnInput,
  ShopperReturnReceipt,
} from '../generated/graphql/storefront-types.js';
import type {
  MutationCompleteOrderReturnWithoutRefundArgs,
  MutationDecideOrderReturnArgs,
  MutationRecordOrderReturnRefundArgs,
  OrderRefund,
  OrderReturnCase,
  OrderReturnPage,
  OrderReturnSummary,
  QueryOrderReturnsArgs,
} from '../generated/graphql/types.js';
import { LocalMailbox, type EmailLanguage } from '../local-mailbox/local-mailbox.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { OrdersService } from '../orders/orders.service.js';
import { RefundsService, presentRefund, refundBalance } from '../refunds/refunds.service.js';
import { requireMerchant, requireScope, type RequestContext, type ShopperScope } from '../scope.js';
import { returnRequestEmail } from './return-email.js';
import { coversWholeOrder } from './return-lines.js';
import { ReturnsRepository, type ReturnCaseRow } from './returns.repository.js';

const returnWindowMs = 14 * 24 * 60 * 60 * 1000;

function summary(
  row: Pick<ReturnCaseRow, 'id' | 'reason' | 'status' | 'requestedAt' | 'completedAt'> & {
    order: { orderNumber: string };
  },
): Omit<OrderReturnSummary, '__typename'> {
  return {
    id: row.id,
    orderNumber: row.order.orderNumber,
    reason: row.reason,
    status: row.completedAt ? 'COMPLETED' : row.status,
    requestedAt: row.requestedAt.toISOString(),
  };
}

function detail(row: ReturnCaseRow): OrderReturnCase {
  const decision = row.decision;
  const fullOrder = coversWholeOrder(row.order.lines, row.lines);
  const openApproval = row.status === 'APPROVED' && !row.completedAt;
  const { remaining } = refundBalance(row.order);
  return {
    ...summary(row),
    orderId: row.orderId,
    fullOrder,
    canRecordRefund: openApproval && !row.refund && remaining.gt(0),
    canCompleteWithoutRefund: openApproval && fullOrder && remaining.isZero(),
    completion: row.completedAt
      ? {
          returnCaseId: row.id,
          completedAt: row.completedAt.toISOString(),
          stockRestored: row.completionStockRestored,
        }
      : null,
    refund: row.refund ? presentRefund(row.refund) : null,
    lines: row.lines.map(({ orderLineId, quantity, orderLine }) => ({
      orderLineId,
      quantity,
      ...orderLine,
    })),
    decisions: decision
      ? [
          {
            outcome: decision.outcome,
            decidedByUserId: decision.decidedByUserId,
            decidedAt: decision.decidedAt.toISOString(),
          },
        ]
      : [],
  };
}

@Injectable()
export class ReturnsService {
  constructor(
    private readonly returns: ReturnsRepository,
    private readonly orders: OrdersRepository,
    private readonly orderService: OrdersService,
    private readonly refunds: RefundsService,
    private readonly mailbox: LocalMailbox,
  ) {}

  async request(
    { tenantId, branchId, customerId, email }: ShopperScope & { email: string },
    input: ShopperReturnInput,
    language: EmailLanguage,
  ): Promise<ShopperReturnReceipt> {
    if (!isUUID(input.orderId)) {
      throw new NotFoundException('Order not found');
    }
    const orderId = input.orderId.toLowerCase();
    const scope = { tenantId, branchId };
    return this.orders.transaction(async (tx) => {
      // All submissions for this order check and reserve quantities under the same lock.
      const order = await this.orders.lockOrder(tx, { ...scope, customerId }, orderId);
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === 'CANCELLED' || Date.now() > order.placedAt.getTime() + returnWindowMs) {
        throw contentInputError(
          'orderId',
          'ORDER_NOT_RETURNABLE',
          'This order is not eligible for return',
        );
      }
      const reason = input.reason.trim();
      if (!reason || reason.includes('\u0000')) {
        throw contentInputError('reason', 'INVALID_VALUE', 'Enter a valid return reason');
      }
      if (input.lines.length === 0) {
        throw contentInputError('lines', 'INVALID_VALUE', 'Select at least one order line');
      }
      const ordered = new Map(order.lines.map(({ id, quantity }) => [id, quantity]));
      const requested = new Map<string, number>();
      for (const line of input.lines) {
        const orderLineId = line.orderLineId.toLowerCase();
        if (!ordered.has(orderLineId)) {
          throw contentInputError('lines', 'INVALID_ORDER_LINE', 'Select a line from this order');
        }
        if (line.quantity < 1) {
          throw contentInputError('lines', 'INVALID_QUANTITY', 'Enter a positive quantity');
        }
        requested.set(orderLineId, (requested.get(orderLineId) ?? 0) + line.quantity);
      }
      const { cases, quantities } = await this.orders.returnReservations(tx, scope, orderId);
      if (
        cases.some(
          (existing) =>
            existing.status !== 'REJECTED' &&
            existing.reason === reason &&
            existing.lines.length === requested.size &&
            existing.lines.every(
              ({ orderLineId, quantity }) => requested.get(orderLineId) === quantity,
            ),
        )
      ) {
        throw contentInputError(
          'lines',
          'DUPLICATE_RETURN_REQUEST',
          'This return has already been requested',
        );
      }
      for (const [orderLineId, quantity] of requested) {
        if (quantity > (ordered.get(orderLineId) ?? 0) - (quantities.get(orderLineId) ?? 0)) {
          throw contentInputError(
            'lines',
            'INVALID_QUANTITY',
            'Quantity exceeds the returnable units',
          );
        }
      }
      const lines = Array.from(requested, ([orderLineId, quantity]) => ({ orderLineId, quantity }));
      const receipt = await this.returns.request(tx, scope, orderId, reason, lines);
      const requestedLines = order.lines.flatMap(({ id, label, sku }) => {
        const quantity = requested.get(id);
        return quantity === undefined ? [] : [{ label, sku, quantity }];
      });
      await this.mailbox.capture(
        tx,
        scope,
        returnRequestEmail(receipt, email, language, requestedLines),
      );
      const { id, requestedAt } = receipt;
      return { id, requestedAt: requestedAt.toISOString() };
    });
  }

  async list(
    context: RequestContext,
    { offset = 0, limit = 20 }: QueryOrderReturnsArgs,
  ): Promise<OrderReturnPage> {
    const scope = await requireScope(context, false);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const { items, total } = await this.returns.list(scope, offset, limit);
    return { items: items.map(summary), total };
  }

  async find(context: RequestContext, id: string): Promise<OrderReturnCase | null> {
    const scope = await requireScope(context, false);
    const row = isUUID(id) ? await this.returns.find(scope, id.toLowerCase()) : null;
    return row ? detail(row) : null;
  }

  async decide(
    context: RequestContext,
    { id, outcome }: MutationDecideOrderReturnArgs,
  ): Promise<OrderReturnCase> {
    const { scope, userId } = await requireMerchant(context, true);
    if (!isUUID(id)) {
      throw new NotFoundException('Return case is unavailable');
    }
    const { record, changed } = await this.returns.decide(scope, id.toLowerCase(), outcome, userId);
    if (!record) {
      throw new NotFoundException('Return case is unavailable');
    }
    if (!changed) {
      throw new GraphQLError('Return case has already been decided', {
        extensions: { code: 'CONFLICT' },
      });
    }
    return detail(record);
  }

  async recordRefund(
    context: RequestContext,
    { id, input }: MutationRecordOrderReturnRefundArgs,
  ): Promise<OrderRefund> {
    const scope = await requireScope(context, true);
    if (!isUUID(id)) {
      throw new NotFoundException('Return case is unavailable');
    }
    const returnId = id.toLowerCase();
    return this.orders.transaction(async (tx) => {
      const target = await this.returns.orderId(tx, scope, returnId);
      const order = target && (await this.orders.lockOrder(tx, scope, target.orderId));
      if (!order) {
        throw new NotFoundException('Return case is unavailable');
      }
      // Check settlement and balance under the same order lock used by direct refunds.
      const row = await this.returns.settlement(tx, scope, order.id, returnId);
      if (row.status !== 'APPROVED' || row.refund || row.completedAt) {
        throw new GraphQLError('Return case must be approved and unsettled', {
          extensions: { code: 'CONFLICT' },
        });
      }
      return this.refunds.recordLocked(
        tx,
        scope,
        order,
        { ...input, restock: input.restock === true && coversWholeOrder(order.lines, row.lines) },
        returnId,
      );
    });
  }

  async completeWithoutRefund(
    context: RequestContext,
    { id }: MutationCompleteOrderReturnWithoutRefundArgs,
  ): Promise<OrderReturnCase> {
    const scope = await requireScope(context, true);
    if (!isUUID(id)) {
      throw new NotFoundException('Return case is unavailable');
    }
    const returnId = id.toLowerCase();
    return this.orders.transaction(async (tx) => {
      const target = await this.returns.orderId(tx, scope, returnId);
      const order = target && (await this.orders.lockOrder(tx, scope, target.orderId));
      const row = order && (await this.returns.find(scope, returnId, tx));
      if (!order || !row) {
        throw new NotFoundException('Return case is unavailable');
      }
      if (!detail(row).canCompleteWithoutRefund) {
        throw new GraphQLError('Return case must be approved, full and have no refund remaining', {
          extensions: { code: 'CONFLICT' },
        });
      }
      const stockRestored =
        !row.order.refunds.some(({ restock }) => restock) &&
        (await this.orderService.restockLockedOrder(tx, scope, order));
      return detail(await this.returns.complete(tx, scope, returnId, stockRestored));
    });
  }
}
