import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type {
  CharacteristicGroupInput,
  QueryCharacteristicGroupsArgs,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { CharacteristicsRepository } from './characteristics.repository.js';

function fieldError(path: string, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function invalidId(index: number) {
  return fieldError(
    `characteristics.${String(index)}.id`,
    'INVALID_VALUE',
    'Choose a characteristic from this group',
  );
}

function duplicateName(index: number) {
  return fieldError(
    `characteristics.${String(index)}.name`,
    'DUPLICATE_VALUE',
    'This group already uses the characteristic name',
  );
}

function definition(
  { name, sortOrder, active }: Omit<CharacteristicGroupInput, 'characteristics'>,
  prefix = '',
) {
  const text = name.trim();
  if (!text || Array.from(text).length > 200 || text.includes('\u0000')) {
    throw fieldError(`${prefix}name`, 'INVALID_VALUE', 'Name must contain 1 to 200 characters');
  }
  if (sortOrder < 0) {
    throw fieldError(`${prefix}sortOrder`, 'INVALID_VALUE', 'Sort order must be nonnegative');
  }
  return { name: text, sortOrder, active };
}

function groupId(id: string) {
  if (!isUUID(id)) {
    throw new BadRequestException('Characteristic group ID must be a UUID');
  }
  return id.toLowerCase();
}

@Injectable()
export class CharacteristicsService {
  constructor(private readonly repository: CharacteristicsRepository) {}

  async list(context: RequestContext, args: QueryCharacteristicGroupsArgs) {
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

  async find(context: RequestContext, id: string) {
    return this.repository.find(await requireScope(context, false), groupId(id));
  }

  async productCharacteristics(context: RequestContext, productId?: string | null) {
    const scope = await requireScope(context, false);
    if (productId != null && !isUUID(productId)) {
      throw new BadRequestException('Product ID must be a UUID');
    }
    return this.repository.productCharacteristics(scope, productId?.toLowerCase());
  }

  publicSpecifications(scope: Scope, id: string) {
    return isUUID(id) ? this.repository.publicSpecifications(scope, id.toLowerCase()) : [];
  }

  async save(context: RequestContext, input: CharacteristicGroupInput, rawId?: string) {
    const scope = await requireScope(context, true);
    const id = rawId === undefined ? undefined : groupId(rawId);
    const data = definition(input);
    const names = new Set<string>();
    const ids = new Set<string>();
    const characteristics = input.characteristics.map((item, index) => {
      const fields = definition(item, `characteristics.${String(index)}.`);
      const normalized = fields.name.toLowerCase();
      if (names.has(normalized)) {
        throw duplicateName(index);
      }
      names.add(normalized);
      if (item.id == null) {
        return fields;
      }
      const characteristicId = item.id.toLowerCase();
      if (!id || !isUUID(characteristicId) || ids.has(characteristicId)) {
        throw invalidId(index);
      }
      ids.add(characteristicId);
      return { ...fields, id: characteristicId };
    });
    try {
      if (id === undefined) {
        return await this.repository.create(scope, data, characteristics);
      }
      const result = await this.repository.update(scope, id, data, characteristics);
      if (result.invalidIdIndex !== undefined) {
        throw invalidId(result.invalidIdIndex);
      }
      if (result.duplicateNameIndex !== undefined) {
        throw duplicateName(result.duplicateNameIndex);
      }
      return result.row;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw fieldError('name', 'DUPLICATE_VALUE', 'This shop already uses the group name');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Characteristic group not found');
        }
        if (error.code === 'P2034') {
          throw new ConflictException('Characteristic group changed while saving');
        }
      }
      throw error;
    }
  }
}
