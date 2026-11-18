import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Product, ProductInput, QueryProductsArgs } from './generated/graphql/types.js';
import { Prisma, type Product as StoredProduct } from './generated/prisma/client.js';
import { CommerceRepository } from './commerce.repository.js';
import { requireScope, type RequestContext } from './scope.js';

function product(row: StoredProduct): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price.toFixed(2),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function productInput(input: ProductInput): ProductInput {
  const name = input.name.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw new BadRequestException('Product name must contain 1 to 200 characters');
  }
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(input.price)) {
    throw new BadRequestException(
      'Price must be a non-negative decimal with at most two fractional digits',
    );
  }
  return { ...input, name };
}
function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Product ID must be a UUID');
  }
  return id.toLowerCase();
}

@Injectable()
export class CommerceService {
  constructor(private readonly repository: CommerceRepository) {}

  async products(context: RequestContext, args: QueryProductsArgs) {
    const scope = await requireScope(context, false);
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    if (
      args.filter?.statuses &&
      (args.filter.statuses.length === 0 || args.filter.statuses.length > 100)
    ) {
      throw new BadRequestException('Invalid product status filter');
    }
    if ((args.filter?.allOf?.length ?? 0) > 50) {
      throw new BadRequestException('Too many product filter conditions');
    }
    for (const condition of args.filter?.allOf ?? []) {
      if (
        (condition.nameContains !== null &&
          condition.nameContains !== undefined &&
          (!condition.nameContains.trim() ||
            Array.from(condition.nameContains).length > 200 ||
            condition.nameContains.includes('\u0000'))) ||
        (condition.statuses !== null &&
          condition.statuses !== undefined &&
          (condition.statuses.length === 0 || condition.statuses.length > 100)) ||
        [condition.minimumPrice, condition.maximumPrice].some(
          (price) =>
            price !== null && price !== undefined && !/^\d{1,10}(?:\.\d{1,2})?$/.test(price),
        )
      ) {
        throw new BadRequestException('Invalid product filter');
      }
    }
    const result = await this.repository.products(
      scope,
      offset,
      limit,
      words,
      args.filter,
      args.sort,
    );
    return { ...result, items: result.items.map(product) };
  }

  async product(context: RequestContext, id: string) {
    const row = await this.repository.product(await requireScope(context, false), recordId(id));
    return row ? product(row) : null;
  }

  async create(context: RequestContext, input: ProductInput) {
    return product(
      await this.repository.create(await requireScope(context, true), productInput(input)),
    );
  }

  async update(context: RequestContext, id: string, input: ProductInput) {
    const scope = await requireScope(context, true);
    try {
      return product(await this.repository.update(scope, recordId(id), productInput(input)));
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Product not found');
      }
      throw error;
    }
  }

  async customers(context: RequestContext) {
    const rows = await this.repository.customers(await requireScope(context, false));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
