import { Injectable } from '@nestjs/common';
import { normalizeContactPhone } from '../contacts/contact-phone.js';
import { contactWordMatches, searchText } from '../contacts/contact-search.js';
import { DatabaseService } from '../database.service.js';
import type { QueryLeadsArgs } from '../generated/graphql/types.js';
import { Prisma, type Lead, type LeadStage } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { openTaskWhere } from './lead-follow-up.js';
import { closedLeadStages } from './lead-stage.js';
import { taskScheduleOrder } from './lead-task.js';

type LeadFields = Pick<Lead, 'displayName' | 'websiteUrl' | 'sourceName'>;

function withNextTask(tenantId: string) {
  return {
    tasks: {
      where: openTaskWhere(tenantId),
      orderBy: taskScheduleOrder,
      take: 1,
    },
  } satisfies Prisma.LeadInclude;
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    { tenantId, userId }: SalesScope,
    term: string,
    words: string[],
    {
      offset = 0,
      limit = 20,
      sort,
      stage,
      status,
      assignment,
      assignedAgentUserId,
    }: QueryLeadsArgs,
  ) {
    const perWord = words.map((word) => {
      const match = searchText(word);
      return {
        OR: [
          { displayName: match },
          { websiteUrl: match },
          { sourceName: match },
          { contacts: { some: { tenantId, OR: contactWordMatches(word) } } },
        ],
      };
    });
    const phone = normalizeContactPhone(term);
    const assignee =
      assignment === 'MINE'
        ? userId
        : assignment === 'UNASSIGNED'
          ? null
          : (assignedAgentUserId ?? undefined);
    const where: Prisma.LeadWhereInput = {
      tenantId,
      ...(assignee === undefined ? {} : { assignedAgentUserId: assignee }),
      ...(phone ? { contacts: { some: { tenantId, phone } } } : { AND: perWord }),
      stage: {
        ...(stage ? { equals: stage } : {}),
        ...(status === 'CLOSED' ? { in: [...closedLeadStages] } : {}),
        ...((status ?? 'OPEN') === 'OPEN' ? { notIn: [...closedLeadStages] } : {}),
      },
    };
    const direction = sort?.direction === 'ASC' ? 'asc' : 'desc';
    const order: Prisma.LeadOrderByWithRelationInput =
      sort?.field === 'DISPLAY_NAME'
        ? { displayName: { sort: direction, nulls: 'last' } }
        : { createdAt: direction };
    const client = this.database.client;
    const [items, total] = await client.$transaction(
      [
        client.lead.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          include: withNextTask(tenantId),
        }),
        client.lead.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find({ tenantId }: SalesScope, id: string) {
    return this.database.client.lead.findUnique({
      where: { tenantId_id: { tenantId, id } },
      include: withNextTask(tenantId),
    });
  }

  async assignedAgentIds({ tenantId }: SalesScope, ids?: string[]): Promise<string[]> {
    const assigned = await this.database.client.lead.groupBy({
      by: ['assignedAgentUserId'],
      where: { tenantId, assignedAgentUserId: ids ? { in: ids } : { not: null } },
    });
    return assigned.flatMap(({ assignedAgentUserId }) =>
      assignedAgentUserId ? [assignedAgentUserId] : [],
    );
  }

  async referencedAgentIds(scope: SalesScope, ids: string[]): Promise<string[]> {
    const [authors, assignees] = await Promise.all([
      this.database.client.lead.groupBy({
        by: ['createdByUserId'],
        where: { tenantId: scope.tenantId, createdByUserId: { in: ids } },
      }),
      this.assignedAgentIds(scope, ids),
    ]);
    return [...new Set([...authors.map(({ createdByUserId }) => createdByUserId), ...assignees])];
  }

  create({ tenantId, userId }: SalesScope, fields: LeadFields) {
    return this.database.client.lead.create({
      data: { tenantId, ...fields, createdByUserId: userId, assignedAgentUserId: userId },
      include: withNextTask(tenantId),
    });
  }

  update(
    { tenantId }: SalesScope,
    id: string,
    fields: LeadFields | Pick<Lead, 'assignedAgentUserId'>,
  ) {
    return this.database.client.lead.update({
      where: { tenantId_id: { tenantId, id } },
      data: fields,
      include: withNextTask(tenantId),
    });
  }

  async updateStage(scope: SalesScope, id: string, stage: LeadStage, changedAt: Date) {
    const data: Prisma.LeadUpdateManyMutationInput = { stage, stageChangedAt: changedAt };
    if (stage === 'WON') {
      data.wonAt = changedAt;
    } else if (!closedLeadStages.includes(stage)) {
      data.wonAt = null;
    }
    const { tenantId } = scope;
    return this.database.client.$transaction(async (client) => {
      await client.lead.updateMany({ where: { tenantId, id, stage: { not: stage } }, data });
      return client.lead.findUnique({
        where: { tenantId_id: { tenantId, id } },
        include: withNextTask(tenantId),
      });
    });
  }
}
