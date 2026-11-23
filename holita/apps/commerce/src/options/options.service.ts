import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { Option, OptionInput, QueryOptionsArgs } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { OptionsRepository } from './options.repository.js';

function optionError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function invalidValueId(index: number): GraphQLError {
  return optionError(
    `values.${String(index)}.id`,
    'INVALID_VALUE',
    'Choose a value from this option',
  );
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Option ID must be a UUID');
  }
  return id.toLowerCase();
}

function label(value: string, path: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed || Array.from(trimmed).length > 200 || trimmed.includes('\u0000')) {
    throw optionError(path, 'INVALID_VALUE', message);
  }
  return trimmed;
}

function fields(input: OptionInput, updating: boolean) {
  const name = label(input.name, 'name', 'Option name must contain 1 to 200 characters');
  const labels = new Set<string>();
  const ids = new Set<string>();
  const values = input.values.map((value, sortOrder) => {
    const path = `values.${String(sortOrder)}.label`;
    const text = label(value.label, path, 'Value label must contain 1 to 200 characters');
    const normalized = text.toLowerCase();
    if (labels.has(normalized)) {
      throw optionError(path, 'DUPLICATE_VALUE', 'This option already contains the label');
    }
    labels.add(normalized);
    const swatchColor = value.swatchColor?.trim().toUpperCase() ?? value.swatchColor;
    if (typeof swatchColor === 'string' && !/^#[0-9A-F]{6}$/.test(swatchColor)) {
      throw optionError(
        `values.${String(sortOrder)}.swatchColor`,
        'INVALID_VALUE',
        'Enter a colour in #RRGGBB format',
      );
    }
    const fields = {
      label: text,
      sortOrder,
      ...(swatchColor === undefined ? {} : { swatchColor }),
    };
    if (value.id == null) {
      return fields;
    }
    const id = value.id.toLowerCase();
    if (!updating || !isUUID(id) || ids.has(id)) {
      throw invalidValueId(sortOrder);
    }
    ids.add(id);
    return { id, ...fields };
  });
  return {
    data: {
      name,
      active: input.active,
      showInFilters: input.showInFilters,
      ...(input.showInListing == null ? {} : { showInListing: input.showInListing }),
    },
    values,
  };
}

function present(row: Prisma.OptionGetPayload<{ include: { values: true } }>): Option {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    showInFilters: row.showInFilters,
    showInListing: row.showInListing,
    values: row.values.map(({ id, label, swatchColor }) => ({ id, label, swatchColor })),
  };
}

@Injectable()
export class OptionsService {
  constructor(private readonly repository: OptionsRepository) {}

  async list(context: RequestContext, args: QueryOptionsArgs) {
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
    const result = await this.repository.list(scope, offset, limit, words, args.sort);
    return { ...result, items: result.items.map(present) };
  }

  async productOptions(context: RequestContext) {
    return (await this.repository.productOptions(await requireScope(context, false))).map(present);
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async save(context: RequestContext, input: OptionInput, id?: string) {
    const scope = await requireScope(context, true);
    const { data, values } = fields(input, id !== undefined);
    try {
      if (id === undefined) {
        return present(await this.repository.create(scope, data, values));
      }
      const result = await this.repository.update(scope, recordId(id), data, values);
      if (result.invalidValueIndex !== undefined) {
        throw invalidValueId(result.invalidValueIndex);
      }
      return present(result.row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw optionError('name', 'DUPLICATE_VALUE', 'This shop already uses the option name');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Option not found');
        }
        if (error.code === 'P2003') {
          throw new GraphQLError('An option value is used by a product variant', {
            extensions: { code: 'CONFLICT' },
          });
        }
        if (error.code === 'P2034') {
          throw new ConflictException('Option changed while saving');
        }
      }
      throw error;
    }
  }
}
