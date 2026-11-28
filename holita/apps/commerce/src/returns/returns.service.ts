import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type {
  MutationDecideOrderReturnArgs,
  OrderReturnCase,
  OrderReturnPage,
  OrderReturnSummary,
  QueryOrderReturnsArgs,
} from '../generated/graphql/types.js';
import { requireMerchant, requireScope, type RequestContext } from '../scope.js';
import { ReturnsRepository, type ReturnCaseRow } from './returns.repository.js';

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
  constructor(private readonly returns: ReturnsRepository) {}

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
