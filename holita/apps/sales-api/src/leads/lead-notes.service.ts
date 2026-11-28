import { Injectable } from '@nestjs/common';
import type { LeadNote, LeadNoteActivity, LeadNoteInput } from '../generated/graphql/types.js';
import type { LeadNote as StoredNote } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { CoreSalesAgents } from './core-sales-agents.js';
import {
  activityId,
  activityInstant,
  activityWriteError,
  salesFieldError,
} from './lead-activity-input.js';
import { LeadNotesRepository } from './lead-notes.repository.js';

function present({
  id,
  leadId,
  occurredAt,
  text,
  authorUserId,
  createdAt,
  updatedAt,
}: StoredNote): LeadNote {
  return {
    id,
    leadId,
    occurredAt: occurredAt.toISOString(),
    text,
    authorUserId,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function fields(input: LeadNoteInput) {
  const text = input.text.trim();
  if (!text) {
    throw salesFieldError('text', 'REQUIRED', 'Enter a note');
  }
  if (text.includes('\u0000')) {
    throw salesFieldError('text', 'INVALID_VALUE', 'Text must not contain a null character');
  }
  const occurredAt = activityInstant(input.occurredAt);
  if (!occurredAt) {
    throw salesFieldError(
      'occurredAt',
      'INVALID_VALUE',
      'Enter an ISO date and time with a time zone',
    );
  }
  return { text, occurredAt };
}

function recordId(id: string): string {
  return activityId(id, 'note');
}

const authorLookupLimit = 101;

@Injectable()
export class LeadNotesService {
  constructor(
    private readonly repository: LeadNotesRepository,
    private readonly agents: CoreSalesAgents,
  ) {}

  async list(scope: SalesScope, leadId: string): Promise<LeadNoteActivity[]> {
    const rows = await this.repository.list(scope, recordId(leadId));
    const ids = [...new Set(rows.map(({ authorUserId }) => authorUserId))];
    const names = new Map<string, string>();
    for (let offset = 0; offset < ids.length; offset += authorLookupLimit) {
      const historicalIds = ids.slice(offset, offset + authorLookupLimit);
      for (const { id, name } of await this.agents.lookup(scope.authorization, {
        ids: [],
        historicalIds,
      })) {
        names.set(id, name);
      }
    }
    return rows.map((row) => ({
      note: present(row),
      authorName: names.get(row.authorUserId) ?? null,
    }));
  }

  async find(scope: SalesScope, leadId: string, id: string): Promise<LeadNote | null> {
    const row = await this.repository.find(scope, recordId(leadId), recordId(id));
    return row ? present(row) : null;
  }

  async create(scope: SalesScope, leadId: string, input: LeadNoteInput): Promise<LeadNote> {
    try {
      return present(await this.repository.create(scope, recordId(leadId), fields(input)));
    } catch (error: unknown) {
      return activityWriteError(error, 'Lead not found');
    }
  }

  async update(
    scope: SalesScope,
    leadId: string,
    id: string,
    input: LeadNoteInput,
  ): Promise<LeadNote> {
    try {
      return present(
        await this.repository.update(scope, recordId(leadId), recordId(id), fields(input)),
      );
    } catch (error: unknown) {
      return activityWriteError(error, 'Lead note not found');
    }
  }

  async delete(scope: SalesScope, leadId: string, id: string): Promise<boolean> {
    try {
      await this.repository.delete(scope, recordId(leadId), recordId(id));
      return true;
    } catch (error: unknown) {
      return activityWriteError(error, 'Lead note not found');
    }
  }
}
