import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CoreClient } from '../core/core.client.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreateProductInput,
  Product,
  ProductPage,
  ProductSortDirection,
  ProductSortField,
  ProductStatus,
  QueryProductsArgs,
  UpdateProductInput,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { ProductsRepository } from './products.repository.js';

export type ProductResult = Omit<Product, 'store'>;

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isUUID(value))
    throw new BadRequestException(`${label} must be a UUID`);
  return value.toLowerCase();
}

function trimmed(value: unknown, label: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || Array.from(text).length > max)
    throw new BadRequestException(
      `${label} must contain 1 to ${String(max)} characters after trimming`,
    );
  if (text.includes('\u0000'))
    throw new BadRequestException(`${label} contains an unsupported character`);
  return text;
}

function status(value: unknown): ProductStatus {
  if (value !== 'DRAFT' && value !== 'ACTIVE')
    throw new BadRequestException('Status must be DRAFT or ACTIVE');
  return value;
}

function sortField(value: unknown): ProductSortField {
  if (value !== 'CREATED_AT' && value !== 'NAME' && value !== 'SKU' && value !== 'STATUS')
    throw new BadRequestException('Sort field must be CREATED_AT, NAME, SKU or STATUS');
  return value;
}

function sortDirection(value: unknown): ProductSortDirection {
  if (value !== 'ASC' && value !== 'DESC')
    throw new BadRequestException('Sort direction must be ASC or DESC');
  return value;
}

function persistenceError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new ConflictException('A product with this SKU already exists in this store');
    if (error.code === 'P2025') throw new NotFoundException('Product not found');
  }
  throw error;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly core: CoreClient,
  ) {}

  list(
    context: RequestContext,
    args: QueryProductsArgs,
  ): Promise<Omit<ProductPage, 'items'> & { items: ProductResult[] }> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;
    if (!Number.isInteger(offset) || offset < 0 || offset > 2147483647)
      throw new BadRequestException('Offset must be an integer from 0 to 2147483647');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Limit must be an integer from 1 to 100');
    return this.products.list(
      storeId,
      offset,
      limit,
      {
        ...(args.search?.trim() ? { search: trimmed(args.search, 'Search', 200) } : {}),
        ...(args.sku?.trim() ? { sku: trimmed(args.sku, 'SKU filter', 100) } : {}),
        ...(args.status != null ? { status: status(args.status) } : {}),
      },
      {
        field: sortField(args.sort?.field ?? 'CREATED_AT'),
        direction: sortDirection(args.sort?.direction ?? 'DESC'),
      },
    );
  }

  async find(context: RequestContext, id: string): Promise<ProductResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const product = await this.products.find(storeId, uuid(id, 'Product ID'));
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(context: RequestContext, input: CreateProductInput): Promise<ProductResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateProductInput = {
      name: trimmed(input.name, 'Name', 200),
      sku: trimmed(input.sku, 'SKU', 100),
      status: status(input.status ?? 'DRAFT'),
    };
    await this.core.requireStore(storeId, context);
    try {
      return await this.products.create(storeId, data);
    } catch (error) {
      persistenceError(error);
    }
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const productId = uuid(id, 'Product ID');
    const data: Parameters<ProductsRepository['update']>[2] = {};
    if (input.name !== undefined) data.name = trimmed(input.name, 'Name', 200);
    if (input.sku !== undefined) data.sku = trimmed(input.sku, 'SKU', 100);
    if (input.status !== undefined) data.status = status(input.status);
    if (Object.keys(data).length === 0)
      throw new BadRequestException('Provide at least one product field to update');
    try {
      return await this.products.update(storeId, productId, data);
    } catch (error) {
      persistenceError(error);
    }
  }

  async delete(context: RequestContext, id: string): Promise<ProductResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    try {
      return await this.products.delete(storeId, uuid(id, 'Product ID'));
    } catch (error) {
      persistenceError(error);
    }
  }
}
