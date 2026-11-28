import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma, type OrderReturnOutcome } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const orderNumber = { select: { orderNumber: true } };

function caseDetail(scope: Scope) {
  return {
    order: orderNumber,
    lines: {
      where: scope,
      orderBy: { orderLine: { sortOrder: 'asc' } },
      include: { orderLine: { select: { sku: true, label: true } } },
    },
    decision: true,
  } satisfies Prisma.OrderReturnCaseInclude;
}

export type ReturnCaseRow = Prisma.OrderReturnCaseGetPayload<{
  include: ReturnType<typeof caseDetail>;
}>;

@Injectable()
export class ReturnsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(scope: Scope, offset: number, limit: number) {
    const client = this.database.client;
    const [items, total] = await client.$transaction(
      [
        client.orderReturnCase.findMany({
          where: scope,
          skip: offset,
          take: limit,
          orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
          include: { order: orderNumber },
        }),
        client.orderReturnCase.count({ where: scope }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total };
  }

  find(scope: Scope, id: string) {
    return this.database.client.$transaction(
      (tx) =>
        tx.orderReturnCase.findUnique({ where: { ...scope, id }, include: caseDetail(scope) }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  decide(scope: Scope, id: string, outcome: OrderReturnOutcome, decidedByUserId: string) {
    return this.database.client.$transaction(async (tx) => {
      const where = { ...scope, id };
      const { count } = await tx.orderReturnCase.updateMany({
        where: { ...where, status: 'PENDING' },
        data: { status: outcome },
      });
      if (count) {
        await tx.orderReturnDecision.create({
          data: { ...scope, returnCaseId: id, outcome, decidedByUserId },
        });
      }
      const record = await tx.orderReturnCase.findUnique({ where, include: caseDetail(scope) });
      return { record, changed: count === 1 };
    });
  }
}
