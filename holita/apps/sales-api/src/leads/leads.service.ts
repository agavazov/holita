import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { contactSearchWords } from '../contacts/contact-search.js';
import type {
  Lead,
  LeadInput,
  LeadStage,
  QueryLeadsArgs,
  QuerySalesAgentsArgs,
} from '../generated/graphql/types.js';
import {
  Prisma,
  type Lead as StoredLead,
  type LeadTask as StoredTask,
} from '../generated/prisma/client.js';
import type { SalesScope } from '../scope.js';
import { CoreSalesAgents } from './core-sales-agents.js';
import { presentTask } from './lead-task.js';
import { LeadsRepository } from './leads.repository.js';

const agentLookupLimit = 101;

function present(row: StoredLead & { tasks: StoredTask[] }): Lead {
  const {
    id,
    displayName,
    websiteUrl,
    sourceName,
    stage,
    stageChangedAt,
    wonAt,
    createdByUserId,
    assignedAgentUserId,
    tasks: [nextTask],
    createdAt,
    updatedAt,
  } = row;
  return {
    id,
    displayName,
    websiteUrl,
    sourceName,
    stage,
    stageChangedAt: stageChangedAt.toISOString(),
    wonAt: wonAt?.toISOString() ?? null,
    createdByUserId,
    assignedAgentUserId,
    nextTask: nextTask ? presentTask(nextTask, assignedAgentUserId) : null,
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

function inputError(path: keyof LeadInput | 'assignedAgentUserId', code: string, message: string) {
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
  constructor(
    private readonly repository: LeadsRepository,
    private readonly agents: CoreSalesAgents,
  ) {}

  async list(scope: SalesScope, args: QueryLeadsArgs) {
    const { offset = 0, limit = 20, search, assignment, assignedAgentUserId } = args;
    const term = (search ?? '').trim();
    const words = contactSearchWords(term);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    if (assignedAgentUserId != null && (assignment || !isUUID(assignedAgentUserId))) {
      throw new BadRequestException('Invalid lead assignment filter');
    }
    const page = await this.repository.list(scope, term, words, {
      ...args,
      assignedAgentUserId: assignedAgentUserId?.toLowerCase() ?? null,
    });
    return { ...page, items: page.items.map(present) };
  }

  async find(scope: SalesScope, id: string): Promise<Lead | null> {
    const row = await this.repository.find(scope, recordId(id));
    return row ? present(row) : null;
  }

  async create(scope: SalesScope, input: LeadInput): Promise<Lead> {
    const details = fields(input);
    const [agent] = await this.agents.lookup(scope.authorization, { ids: [scope.userId] });
    if (!agent?.eligible) {
      throw new ForbiddenException('A platform Sales account is required');
    }
    return present(await this.repository.create(scope, details));
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

  async updateStage(scope: SalesScope, id: string, stage: LeadStage): Promise<Lead> {
    const row = await this.repository.updateStage(scope, recordId(id), stage, new Date());
    if (!row) {
      throw new NotFoundException('Lead not found');
    }
    return present(row);
  }

  async salesAgents(scope: SalesScope, { search, ids }: QuerySalesAgentsArgs) {
    if (ids != null) {
      if (search != null || ids.length > agentLookupLimit || ids.some((id) => !isUUID(id))) {
        throw new BadRequestException('Invalid Sales agent lookup');
      }
      const keys = ids.map((id) => id.toLowerCase());
      const historicalIds = await this.repository.referencedAgentIds(scope, keys);
      return this.agents.lookup(scope.authorization, { ids: keys, historicalIds });
    }
    if (search != null && (search.length > 255 || search.includes('\u0000'))) {
      throw new BadRequestException('Invalid Sales agent search');
    }
    return this.agents.lookup(scope.authorization, { search: search ?? '' });
  }

  async leadAssignmentAgents(scope: SalesScope) {
    const [agents, assignedIds] = await Promise.all([
      this.agents.lookup(scope.authorization, { search: '' }),
      this.repository.assignedAgentIds(scope),
    ]);
    const eligibleIds = new Set(agents.map(({ id }) => id));
    const history = assignedIds.filter((id) => !eligibleIds.has(id));
    for (let offset = 0; offset < history.length; offset += agentLookupLimit) {
      const historicalIds = history.slice(offset, offset + agentLookupLimit);
      agents.push(...(await this.agents.lookup(scope.authorization, { ids: [], historicalIds })));
    }
    return agents.sort((left, right) => left.name.localeCompare(right.name));
  }

  async updateAssignment(scope: SalesScope, id: string, assignee: string | null): Promise<Lead> {
    if (assignee !== null && !isUUID(assignee)) {
      throw inputError('assignedAgentUserId', 'INVALID_FORMAT', 'Sales agent ID must be a UUID');
    }
    const leadId = recordId(id);
    const assignedAgentUserId = assignee?.toLowerCase() ?? null;
    const [agent] = await this.agents.lookup(scope.authorization, {
      ids: assignedAgentUserId === null ? [] : [assignedAgentUserId],
    });
    if (assignedAgentUserId !== null && (!agent?.eligible || agent.id !== assignedAgentUserId)) {
      const existing = await this.repository.find(scope, leadId);
      if (existing?.assignedAgentUserId === assignedAgentUserId) {
        return present(existing);
      }
      throw inputError('assignedAgentUserId', 'INELIGIBLE_AGENT', 'Select an active Sales agent');
    }
    try {
      return present(await this.repository.update(scope, leadId, { assignedAgentUserId }));
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Lead not found');
      }
      throw error;
    }
  }
}
