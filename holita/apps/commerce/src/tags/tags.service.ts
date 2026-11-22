import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { QueryProductTagsArgs } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { TagsRepository } from './tags.repository.js';

function tagNameError(code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'name', code, message }] },
  });
}

@Injectable()
export class TagsService {
  constructor(private readonly repository: TagsRepository) {}

  async list(context: RequestContext, args: QueryProductTagsArgs) {
    const scope = await requireScope(context, false);
    const { limit = 20 } = args;
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    return this.repository.list(scope, limit, words);
  }

  async create(context: RequestContext, rawName: string) {
    const scope = await requireScope(context, true);
    const name = rawName.trim().replace(/\s+/gu, ' ');
    if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
      throw tagNameError('INVALID_VALUE', 'Tag name must contain 1 to 200 characters');
    }
    const normalizedName = name.toLowerCase().normalize();
    try {
      return await this.repository.create(scope, name, normalizedName);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (await this.repository.findByName(scope, normalizedName)) {
          throw tagNameError('DUPLICATE_VALUE', 'This shop already uses the tag name');
        }
        throw new ConflictException('A tag changed while saving. Try again.');
      }
      throw error;
    }
  }
}
