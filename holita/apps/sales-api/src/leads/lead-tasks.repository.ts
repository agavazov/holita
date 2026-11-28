import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { LeadTask } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { activeTaskStatuses, taskScheduleOrder } from './lead-task.js';

type TaskFields = Pick<LeadTask, 'scheduledAt' | 'type' | 'note'>;
export type TaskChanges = TaskFields | Pick<LeadTask, 'status'>;
const withAssignee = { lead: { select: { assignedAgentUserId: true } } } as const;

@Injectable()
export class LeadTasksRepository {
  constructor(private readonly database: DatabaseService) {}

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
