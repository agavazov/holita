import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { QuerySalesTaskQueueArgs } from '../generated/graphql/types.js';
import { Prisma, type LeadTask } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import {
  activeLeadWhere,
  leadWithoutFollowUpWhere,
  openTaskWhere,
  salesTaskBuckets,
  taskDateFilters,
} from './lead-follow-up.js';
import { activeTaskStatuses, taskScheduleOrder } from './lead-task.js';

type TaskFields = Pick<LeadTask, 'scheduledAt' | 'type' | 'note'>;
export type TaskChanges = TaskFields | Pick<LeadTask, 'status'>;
const withAssignee = { lead: { select: { assignedAgentUserId: true } } } as const;
const queueLead = {
  id: true,
  displayName: true,
  websiteUrl: true,
  assignedAgentUserId: true,
} satisfies Prisma.LeadSelect;

@Injectable()
export class LeadTasksRepository {
  constructor(private readonly database: DatabaseService) {}

  queue(
    { tenantId, userId }: SalesScope,
    { scope = 'MINE', bucket, offset = 0, limit = 20 }: QuerySalesTaskQueueArgs,
    reference: Date,
  ) {
    const assignment = scope === 'MINE' ? { assignedAgentUserId: userId } : {};
    const dates = taskDateFilters(reference);
    const buckets = bucket ? [bucket] : salesTaskBuckets;
    const page = { skip: offset, take: limit };
    return this.database.client.$transaction(
      (client) =>
        Promise.all(
          buckets.map(async (bucket) => {
            if (bucket === 'NO_FOLLOW_UP') {
              const where = { ...leadWithoutFollowUpWhere(tenantId), ...assignment };
              const [leads, total] = await Promise.all([
                client.lead.findMany({
                  where,
                  ...page,
                  orderBy: [{ displayName: 'asc' }, { websiteUrl: 'asc' }, { id: 'asc' }],
                  select: queueLead,
                }),
                client.lead.count({ where }),
              ]);
              return { bucket, total, items: leads.map((lead) => ({ lead, task: null })) };
            }
            const where = {
              ...openTaskWhere(tenantId),
              scheduledAt: dates[bucket],
              lead: { ...activeLeadWhere(tenantId), ...assignment },
            };
            const [tasks, total] = await Promise.all([
              client.leadTask.findMany({
                where,
                ...page,
                orderBy: taskScheduleOrder,
                include: { lead: { select: queueLead } },
              }),
              client.leadTask.count({ where }),
            ]);
            return { bucket, total, items: tasks.map(({ lead, ...task }) => ({ lead, task })) };
          }),
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  list({ tenantId }: SalesScope, leadId: string) {
    return this.database.client.leadTask.findMany({
      where: { tenantId, leadId },
      orderBy: taskScheduleOrder,
      include: withAssignee,
    });
  }

  find({ tenantId }: SalesScope, leadId: string, id: string) {
    return this.database.client.leadTask.findUnique({
      where: { id, tenantId, leadId },
      include: withAssignee,
    });
  }

  create({ tenantId }: SalesScope, leadId: string, fields: TaskFields) {
    return this.database.client.leadTask.create({
      data: { ...fields, lead: { connect: { tenantId_id: { tenantId, id: leadId } } } },
      include: withAssignee,
    });
  }

  update({ tenantId }: SalesScope, leadId: string, id: string, data: TaskChanges) {
    return this.database.client.leadTask.update({
      where: { id, tenantId, leadId, status: { in: activeTaskStatuses } },
      data,
      include: withAssignee,
    });
  }
}
