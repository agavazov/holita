import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { LeadNote, LeadNoteActivity, LeadNoteInput } from '../generated/graphql/types.js';
import { Prisma, type LeadNote as StoredNote } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { CoreSalesAgents } from './core-sales-agents.js';
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

function recordId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
    throw new BadRequestException('Lead and note IDs must be UUIDs');
  }
  return id.toLowerCase();
}

function fieldError(path: keyof LeadNoteInput, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function fields(input: LeadNoteInput) {
  const text = input.text.trim();
  if (!text) {
    throw fieldError('text', 'REQUIRED', 'Enter a note');
  }
  if (text.includes('\u0000')) {
    throw fieldError('text', 'INVALID_VALUE', 'Text must not contain a null character');
  }
  const value = input.occurredAt.trim();
  const occurredAt = new Date(value);
  if (
    !/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !isISO8601(value, { strict: true, strictSeparator: true }) ||
    Number.isNaN(occurredAt.getTime())
  ) {
    throw fieldError('occurredAt', 'INVALID_VALUE', 'Enter an ISO date and time with a time zone');
  }
  return { text, occurredAt };
}

function writeError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new NotFoundException(message);
  }
  throw error;
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
      return writeError(error, 'Lead not found');
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
      return writeError(error, 'Lead note not found');
    }
  }

  async delete(scope: SalesScope, leadId: string, id: string): Promise<boolean> {
    try {
      await this.repository.delete(scope, recordId(leadId), recordId(id));
      return true;
    } catch (error: unknown) {
      return writeError(error, 'Lead note not found');
    }
  }
}
