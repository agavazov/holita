import { Injectable } from '@nestjs/common';
import type { LeadTaskInput, LeadTaskStatus } from '../generated/graphql/types.js';
import type { SalesScope } from '../scope.js';
import {
  activityId,
  activityInstant,
  activityWriteError,
  salesFieldError,
} from './lead-activity-input.js';
import { presentTask } from './lead-task.js';
import { LeadTasksRepository, type TaskChanges } from './lead-tasks.repository.js';

function fields(input: LeadTaskInput) {
  const scheduledAt = activityInstant(input.scheduledAt);
  if (!scheduledAt) {
    throw salesFieldError(
      'scheduledAt',
      'INVALID_VALUE',
      'Enter an ISO date and time with a time zone',
    );
  }
  const note = input.note?.trim() || null;
  if (note?.includes('\u0000')) {
    throw salesFieldError('note', 'INVALID_VALUE', 'Text must not contain a null character');
  }
  return { scheduledAt, type: input.type, note };
}

@Injectable()
export class LeadTasksService {
  constructor(private readonly repository: LeadTasksRepository) {}

  async list(scope: SalesScope, leadId: string) {
    const rows = await this.repository.list(scope, activityId(leadId, 'task'));
    return rows.map((row) => presentTask(row, row.lead.assignedAgentUserId));
  }

  async find(scope: SalesScope, leadId: string, id: string) {
    const row = await this.repository.find(
      scope,
      activityId(leadId, 'task'),
      activityId(id, 'task'),
    );
    return row ? presentTask(row, row.lead.assignedAgentUserId) : null;
  }

  async create(scope: SalesScope, leadId: string, input: LeadTaskInput) {
    try {
      const row = await this.repository.create(scope, activityId(leadId, 'task'), fields(input));
      return presentTask(row, row.lead.assignedAgentUserId);
    } catch (error: unknown) {
      return activityWriteError(error, 'Lead not found');
    }
  }

  async update(scope: SalesScope, leadId: string, id: string, input: LeadTaskInput) {
    return this.write(scope, leadId, id, fields(input));
  }

  async updateStatus(scope: SalesScope, leadId: string, id: string, status: LeadTaskStatus) {
    return this.write(scope, leadId, id, { status });
  }

  private async write(scope: SalesScope, leadId: string, id: string, data: TaskChanges) {
    try {
      const row = await this.repository.update(
        scope,
        activityId(leadId, 'task'),
        activityId(id, 'task'),
        data,
      );
      return presentTask(row, row.lead.assignedAgentUserId);
    } catch (error: unknown) {
      return activityWriteError(error, 'Open lead task not found');
    }
  }
}
