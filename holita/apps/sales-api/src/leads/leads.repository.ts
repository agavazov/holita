import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeContactPhone } from '../contacts/contact-phone.js';
import { contactWordMatches, searchText } from '../contacts/contact-search.js';
import { DatabaseService } from '../database.service.js';
import type { LeadHandoffInput, QueryLeadsArgs } from '../generated/graphql/types.js';
import { Prisma, type Lead, type LeadHandoff, type LeadStage } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import type { CoreMerchantProvisioning } from './core-merchant-provisioning.js';
import { openTaskWhere } from './lead-follow-up.js';
import { closedLeadStages } from './lead-stage.js';
import { taskScheduleOrder } from './lead-task.js';

type LeadFields = Pick<Lead, 'displayName' | 'websiteUrl' | 'sourceName'>;

function withNextTask(tenantId: string) {
  return {
    handoff: true,
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
      await this.lockLead(client, tenantId, id);
      if (stage !== 'WON') {
        const handoff = await client.leadHandoff.findUnique({
          where: { tenantId_leadId: { tenantId, leadId: id } },
        });
        if (handoff && handoff.state !== 'REJECTED') {
          throw new ConflictException('A pending or completed handoff keeps the lead Won');
        }
      }
      await client.lead.updateMany({ where: { tenantId, id, stage: { not: stage } }, data });
      return client.lead.findUnique({
        where: { tenantId_id: { tenantId, id } },
        include: withNextTask(tenantId),
      });
    });
  }

  private lockLead(client: Prisma.TransactionClient, tenantId: string, id: string) {
    return client.$queryRaw`
      SELECT "id" FROM ${this.database.table('lead')}
      WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${id}::uuid FOR UPDATE
    `;
  }

  reserveHandoff({ tenantId, userId }: SalesScope, id: string, input: LeadHandoffInput | null) {
    return this.database.client.$transaction(async (client) => {
      await this.lockLead(client, tenantId, id);
      const lead = await client.lead.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { stage: true, handoff: true },
      });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
      if (lead.stage !== 'WON') {
        throw new ConflictException('Only Won leads can be converted');
      }
      if (lead.handoff?.state === 'COMPLETED') {
        return { handoff: lead.handoff, fresh: false };
      }
      if (lead.handoff?.state === 'PENDING') {
        if (input) {
          throw new ConflictException('Resume the pending handoff with its original details');
        }
        return { handoff: lead.handoff, fresh: false };
      }
      if (!input) {
        throw new ConflictException('Enter the onboarding details');
      }
      const handoff = await client.leadHandoff.upsert({
        where: { tenantId_leadId: { tenantId, leadId: id } },
        create: { tenantId, leadId: id, initiatedByUserId: userId, ...input },
        update: { ...input, state: 'PENDING' },
      });
      return { handoff, fresh: true };
    });
  }

  provisionHandoff(
    { tenantId }: SalesScope,
    reservation: LeadHandoff,
    fresh: boolean,
    provision: (input: LeadHandoffInput) => ReturnType<CoreMerchantProvisioning['provision']>,
  ) {
    const { leadId } = reservation;
    const where = { tenantId_leadId: { tenantId, leadId } };
    return this.database.client.$transaction(async (client) => {
      // Settle Core attempts in order while keeping the reservation durable across a lost reply.
      await this.lockLead(client, tenantId, leadId);
      const current = await client.leadHandoff.findUniqueOrThrow({ where });
      if (current.state === 'COMPLETED') {
        return { handoff: current };
      }
      const { merchantName, adminName, adminEmail, branchName } = current;
      if (
        current.state !== 'PENDING' ||
        !merchantName ||
        !adminName ||
        !adminEmail ||
        !branchName ||
        merchantName !== reservation.merchantName ||
        adminName !== reservation.adminName ||
        adminEmail !== reservation.adminEmail ||
        branchName !== reservation.branchName ||
        current.updatedAt.getTime() !== reservation.updatedAt.getTime()
      ) {
        throw new ConflictException('The handoff changed. Reload the lead and try again');
      }
      const result = await provision({ merchantName, adminName, adminEmail, branchName });
      if ('error' in result) {
        if (fresh || ('passwordError' in result && !result.passwordError)) {
          await client.leadHandoff.update({ where, data: { state: 'REJECTED' } });
        }
        return { error: result.error };
      }
      const handoff = await client.leadHandoff.update({
        where,
        data: {
          ...result.destination,
          state: 'COMPLETED',
          completedAt: new Date(),
          merchantName: null,
          adminName: null,
          adminEmail: null,
          branchName: null,
        },
      });
      return { handoff };
    });
  }
}
