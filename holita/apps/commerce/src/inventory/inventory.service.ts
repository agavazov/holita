import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { InventoryVariant, QueryInventoryArgs } from '../generated/graphql/types.js';
import { requireScope, type RequestContext } from '../scope.js';
import { InventoryRepository } from './inventory.repository.js';

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Variant ID must be a UUID');
  }
  return id.toLowerCase();
}

function quantityError(code: 'INVALID_VALUE' | 'INVENTORY_TRACKING_REQUIRED', message: string) {
  return new GraphQLError(message, {
    extensions: {
      code: code === 'INVALID_VALUE' ? 'BAD_USER_INPUT' : code,
      fieldErrors: [{ path: 'quantity', code, message }],
    },
  });
}

type VariantRow = NonNullable<Awaited<ReturnType<InventoryRepository['find']>>>;

function present({ product, values, ...row }: VariantRow): InventoryVariant {
  return {
    ...row,
    productName: product.name,
    optionValues: values.map(({ optionValue }) => ({
      optionName: optionValue.option.name,
      label: optionValue.label,
    })),
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async list(context: RequestContext, args: QueryInventoryArgs) {
    const scope = await requireScope(context, false);
    const { offset = 0, limit = 20 } = args;
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    const result = await this.repository.list(scope, offset, limit, words, args.filter, args.sort);
    return { ...result, items: result.items.map(present) };
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async updateQuantity(context: RequestContext, id: string, quantity: number) {
    const scope = await requireScope(context, true);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2_147_483_647) {
      throw quantityError('INVALID_VALUE', 'Enter a non-negative whole quantity');
    }
    const result = await this.repository.updateQuantity(scope, recordId(id), quantity);
    if (result.kind === 'missing') {
      throw new NotFoundException('Variant not found');
    }
    if (result.kind === 'untracked') {
      throw quantityError('INVENTORY_TRACKING_REQUIRED', 'This variant does not track stock');
    }
    return present(result.row);
  }
}
