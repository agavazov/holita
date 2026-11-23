import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Lead, LeadInput, QueryLeadsArgs } from '../generated/graphql/types.js';
import { Prisma, type Lead as StoredLead } from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { LeadsRepository } from './leads.repository.js';

function present(row: StoredLead): Lead {
  const { id, displayName, websiteUrl, sourceName, createdByUserId, createdAt, updatedAt } = row;
  return {
    id,
    displayName,
    websiteUrl,
    sourceName,
    createdByUserId,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function recordId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
    throw new BadRequestException('Lead ID must be a UUID');
  }
  return id.toLowerCase();
}

function inputError(path: keyof LeadInput, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function text(input: LeadInput, path: keyof LeadInput, maximum: number): string | null {
  const value = input[path]?.trim();
  if (value?.includes('\u0000')) {
    throw inputError(path, 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (value && Array.from(value).length > maximum) {
    throw inputError(path, 'TOO_LONG', 'Text exceeds the maximum length');
  }
  return value || null;
}

function fields(input: LeadInput) {
  const displayName = text(input, 'displayName', 255);
  const websiteUrl = text(input, 'websiteUrl', 2048);
  const sourceName = text(input, 'sourceName', 255);
  if (
    websiteUrl &&
    (!/^https?:\/\/[^/\s\\]/iu.test(websiteUrl) || !URL.parse(websiteUrl)?.hostname)
  ) {
    throw inputError('websiteUrl', 'INVALID_FORMAT', 'Enter a complete HTTP or HTTPS website URL');
  }
  if (!displayName && !websiteUrl) {
    throw inputError('displayName', 'IDENTITY_REQUIRED', 'Enter a display name or a website URL');
  }
  return { displayName, websiteUrl, sourceName };
}

@Injectable()
export class LeadsService {
  constructor(private readonly repository: LeadsRepository) {}

  async list(scope: SalesScope, { offset = 0, limit = 20, search, sort }: QueryLeadsArgs) {
    const term = (search ?? '').trim();
    const words = term.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(scope, offset, limit, term, words, sort);
    return { ...page, items: page.items.map(present) };
  }

  async find(scope: SalesScope, id: string): Promise<Lead | null> {
    const row = await this.repository.find(scope, recordId(id));
    return row ? present(row) : null;
  }

  async create(scope: SalesScope, input: LeadInput): Promise<Lead> {
    return present(await this.repository.create(scope, fields(input)));
  }

  async update(scope: SalesScope, id: string, input: LeadInput): Promise<Lead> {
    try {
      return present(await this.repository.update(scope, recordId(id), fields(input)));
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Lead not found');
      }
      throw error;
    }
  }
}
