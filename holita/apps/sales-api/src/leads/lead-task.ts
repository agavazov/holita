import type { LeadTask } from '../generated/graphql/types.js';
import type { LeadTask as StoredTask, LeadTaskStatus, Prisma } from '../generated/prisma/client.js';

export const activeTaskStatuses: LeadTaskStatus[] = ['PENDING', 'IN_PROGRESS'];
export const taskScheduleOrder = [
  { scheduledAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.LeadTaskOrderByWithRelationInput[];

export function presentTask(task: StoredTask, assignedAgentUserId: string | null): LeadTask {
  return {
    id: task.id,
    leadId: task.leadId,
    scheduledAt: task.scheduledAt.toISOString(),
    type: task.type,
    status: task.status,
    note: task.note,
    assignedAgentUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
