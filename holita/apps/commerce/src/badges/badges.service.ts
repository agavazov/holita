import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { ProductBadgeInput, QueryProductBadgesArgs } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { BadgesRepository } from './badges.repository.js';

function badgeError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Badge ID must be a UUID');
  }
  return id.toLowerCase();
}

function fields(input: ProductBadgeInput): ProductBadgeInput {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw badgeError('name', 'INVALID_VALUE', 'Badge name must contain 1 to 200 characters');
  }
  if (slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw badgeError('slug', 'INVALID_FORMAT', 'Use lowercase letters, digits and hyphens');
  }
  if (input.sortOrder < 0) {
    throw badgeError('sortOrder', 'INVALID_VALUE', 'Sort order must be a non-negative integer');
  }
  return { ...input, name, slug };
}

@Injectable()
export class BadgesService {
  constructor(private readonly repository: BadgesRepository) {}

  async list(context: RequestContext, args: QueryProductBadgesArgs) {
    const scope = await requireScope(context, false);
    const { offset = 0, limit = 20 } = args;
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    return this.repository.list(scope, offset, limit, words, args.sort);
  }

  async choices(context: RequestContext) {
    return this.repository.choices(await requireScope(context, false));
  }

  async find(context: RequestContext, id: string) {
    return this.repository.find(await requireScope(context, false), recordId(id));
  }

  async save(context: RequestContext, input: ProductBadgeInput, id?: string) {
    const scope = await requireScope(context, true);
    try {
      return await this.repository.save(
        scope,
        id === undefined ? undefined : recordId(id),
        fields(input),
      );
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw badgeError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Badge not found');
        }
      }
      throw error;
    }
  }
}
