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
import {
  CharacteristicsRepository,
  InvalidCharacteristicDefinitionError,
} from './characteristics.repository.js';

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

function definitionName(name: string, path: string) {
  const text = name.trim();
  if (!text || Array.from(text).length > 200 || text.includes('\u0000')) {
    throw fieldError(path, 'INVALID_VALUE', 'Name must contain 1 to 200 characters');
  }
  return text;
}

function definition(
  { name, sortOrder, active }: Pick<CharacteristicGroupInput, 'name' | 'sortOrder' | 'active'>,
  prefix = '',
) {
  if (sortOrder < 0) {
    throw fieldError(`${prefix}sortOrder`, 'INVALID_VALUE', 'Sort order must be nonnegative');
  }
  return { name: definitionName(name, `${prefix}name`), sortOrder, active };
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
    const categoryIds = input.categoryIds?.map((categoryId) => categoryId.toLowerCase());
    if (categoryIds?.some((categoryId) => !isUUID(categoryId))) {
      throw fieldError('categoryIds', 'INVALID_VALUE', 'Choose categories from this shop');
    }
    const data = {
      ...definition(input),
      categoryIds: categoryIds ? [...new Set(categoryIds)] : null,
    };
    const names = new Set<string>();
    const ids = new Set<string>();
    const characteristics = input.characteristics.map((item, index) => {
      const path = `characteristics.${String(index)}.`;
      const fields = definition(item, path);
      const normalized = fields.name.toLowerCase();
      if (names.has(normalized)) {
        throw duplicateName(index);
      }
      names.add(normalized);
      const characteristicId = item.id?.toLowerCase();
      if (characteristicId !== undefined) {
        if (!id || !isUUID(characteristicId) || ids.has(characteristicId)) {
          throw invalidId(index);
        }
        ids.add(characteristicId);
      }
      const choiceIds = new Set<string>();
      const choices = item.choices?.map((choice, choiceIndex) => {
        const choicePath = `${path}choices.${String(choiceIndex)}`;
        const choiceId = choice.id?.toLowerCase();
        if (choiceId !== undefined) {
          if (!characteristicId || !isUUID(choiceId) || choiceIds.has(choiceId)) {
            throw fieldError(
              `${choicePath}.id`,
              'INVALID_VALUE',
              'Choose a value from this characteristic',
            );
          }
          choiceIds.add(choiceId);
        }
        return { id: choiceId ?? null, name: definitionName(choice.name, `${choicePath}.name`) };
      });
      return {
        ...fields,
        id: characteristicId ?? null,
        kind: item.kind ?? null,
        choices: choices ?? null,
      };
    });
    try {
      return await this.repository.save(scope, id, data, characteristics);
    } catch (error: unknown) {
      if (error instanceof InvalidCharacteristicDefinitionError) {
        throw fieldError(error.path, error.code, error.message);
      }
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
