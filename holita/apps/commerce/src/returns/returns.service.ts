import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { contentInputError } from '../content-validation.js';
import type {
  ShopperReturnInput,
  ShopperReturnReceipt,
} from '../generated/graphql/storefront-types.js';
import type {
  MutationDecideOrderReturnArgs,
  OrderReturnCase,
  OrderReturnPage,
  OrderReturnSummary,
  QueryOrderReturnsArgs,
} from '../generated/graphql/types.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { requireMerchant, requireScope, type RequestContext, type ShopperScope } from '../scope.js';
import { ReturnsRepository, type ReturnCaseRow } from './returns.repository.js';

const returnWindowMs = 14 * 24 * 60 * 60 * 1000;

function summary(
  row: Pick<ReturnCaseRow, 'id' | 'order' | 'reason' | 'status' | 'requestedAt'>,
): Omit<OrderReturnSummary, '__typename'> {
  return {
    id: row.id,
    orderNumber: row.order.orderNumber,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
  };
}

function detail(row: ReturnCaseRow): OrderReturnCase {
  const decision = row.decision;
  return {
    ...summary(row),
    orderId: row.orderId,
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
  ) {}

  async request(shopper: ShopperScope, input: ShopperReturnInput): Promise<ShopperReturnReceipt> {
    if (!isUUID(input.orderId)) {
      throw new NotFoundException('Order not found');
    }
    const orderId = input.orderId.toLowerCase();
    const { tenantId, branchId } = shopper;
    const scope = { tenantId, branchId };
    return this.orders.transaction(async (tx) => {
      // All submissions for this order check and reserve quantities under the same lock.
      const order = await this.orders.lockOrder(tx, shopper, orderId);
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
      const { id, requestedAt } = await this.returns.request(tx, scope, orderId, reason, lines);
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
}
