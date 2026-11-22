import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { CartPrice } from '../cart/cart.service.js';
import type {
  OrderRefund,
  OrderRefundSummary,
  RecordOrderRefundInput,
} from '../generated/graphql/types.js';
import type { Order, OrderRefund as StoredRefund, Prisma } from '../generated/prisma/client.js';
import { canCancelOrder, OrdersService } from '../orders/orders.service.js';
import { requireScope, type RequestContext } from '../scope.js';
import { RefundsRepository } from './refunds.repository.js';

function inputError(path: keyof RecordOrderRefundInput, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function refundAmount(raw: string) {
  const value = raw.trim();
  const amount = /^\d{1,30}(?:\.\d{1,2})?$/u.test(value) ? new CartPrice(value) : null;
  if (!amount?.gt(0)) {
    throw inputError(
      'amount',
      'REFUND_AMOUNT_INVALID',
      'Enter a positive amount with up to two decimal places',
    );
  }
  return amount;
}

function remainingBalance(order: Pick<Order, 'paymentStatus' | 'total'>, refunded: Prisma.Decimal) {
  // Order payments are manual and PAID settles the saved gross total, including delivery.
  return new CartPrice(order.paymentStatus === 'PAID' ? order.total : 0).minus(refunded);
}

function present(row: StoredRefund): OrderRefund {
  return {
    id: row.id,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    reason: row.reason,
    restock: row.restock,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly refunds: RefundsRepository,
    private readonly orders: OrdersService,
  ) {}

  async find(context: RequestContext, orderId: string): Promise<OrderRefundSummary | null> {
    const scope = await requireScope(context, false);
    if (!isUUID(orderId)) {
      return null;
    }
    const order = await this.refunds.find(scope, orderId.toLowerCase());
    if (!order) {
      return null;
    }
    const refunded = order.refunds.reduce(
      (total, refund) => total.plus(refund.amount),
      new CartPrice(0),
    );
    const remaining = remainingBalance(order, refunded);
    return {
      status: refunded.isZero() ? 'NONE' : remaining.isZero() ? 'FULL' : 'PARTIAL',
      refundedAmount: refunded.toFixed(2),
      refundableAmount: remaining.toFixed(2),
      canRecordRefund: remaining.gt(0),
      canRestockOnCompletion: remaining.gt(0) && canCancelOrder(order.status),
      refunds: order.refunds.map(present),
    };
  }

  async record(context: RequestContext, orderId: string, input: RecordOrderRefundInput) {
    const scope = await requireScope(context, true);
    const amount = refundAmount(input.amount);
    const reason = input.reason?.trim() || null;
    if (reason?.includes('\u0000')) {
      throw inputError('reason', 'INVALID_VALUE', 'Enter a plain-text reason');
    }
    const restock = input.restock ?? false;
    return this.refunds.transaction(async (tx) => {
      const order = await this.orders.requireLockedOrder(tx, scope, orderId);
      const refunded = await this.refunds.total(tx, scope, order.id);
      const remaining = remainingBalance(order, new CartPrice(refunded ?? 0));
      if (order.paymentStatus !== 'PAID') {
        throw inputError('amount', 'REFUND_INELIGIBLE', 'This order cannot be refunded');
      }
      if (amount.gt(remaining)) {
        throw inputError(
          'amount',
          'REFUND_EXCEEDS_BALANCE',
          'Refund exceeds the remaining balance',
        );
      }
      if (restock) {
        if (!amount.eq(remaining) || !canCancelOrder(order.status)) {
          throw inputError(
            'restock',
            'REFUND_RESTOCK_UNAVAILABLE',
            'Restock is unavailable for this refund',
          );
        }
        await this.orders.changeLockedStatus(tx, scope, order, 'CANCELLED');
      }
      return present(
        await this.refunds.create(tx, scope, order.id, {
          amount,
          currency: order.currency,
          reason,
          restock,
        }),
      );
    });
  }
}
