import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import type { Scope } from '../scope.js';

type RefundData = Pick<
  Prisma.OrderRefundUncheckedCreateInput,
  'amount' | 'currency' | 'reason' | 'restock' | 'returnCaseId' | 'stockRestored'
>;

@Injectable()
export class RefundsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly orders: OrdersRepository,
  ) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.orders.transaction(work);
  }

  find(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) =>
        tx.order.findUnique({
          where: { ...scope, id },
          select: {
            paymentStatus: true,
            status: true,
            total: true,
            refunds: { where: scope, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
          },
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async total(tx: Prisma.TransactionClient, scope: Scope, orderId: string) {
    const { _sum } = await tx.orderRefund.aggregate({
      where: { ...scope, orderId },
      _sum: { amount: true },
    });
    return _sum.amount;
  }

  create(tx: Prisma.TransactionClient, scope: Scope, orderId: string, data: RefundData) {
    return tx.orderRefund.create({ data: { ...scope, orderId, ...data } });
  }
}
