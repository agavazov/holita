import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  CreateProductInput,
  ProductSort,
  ProductSortField,
  QueryProductsArgs,
  UpdateProductInput,
} from '../generated/graphql/types.js';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    storeId: string,
    offset: number,
    limit: number,
    filters: Pick<QueryProductsArgs, 'search' | 'sku' | 'status'> = {},
    sort: Required<ProductSort> = { field: 'CREATED_AT', direction: 'DESC' },
  ) {
    const literal = (value: string) => value.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.ProductWhereInput = {
      storeId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sku ? { sku: { contains: literal(filters.sku), mode: 'insensitive' } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: literal(filters.search), mode: 'insensitive' } },
              { sku: { contains: literal(filters.search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const direction = sort.direction === 'ASC' ? 'asc' : 'desc';
    const ordering: Record<ProductSortField, Prisma.ProductOrderByWithRelationInput> = {
      CREATED_AT: { createdAt: direction },
      NAME: { name: direction },
      SKU: { sku: direction },
      // Match the displayed labels (Active, Draft); the PostgreSQL enum declares Draft first.
      STATUS: { status: direction === 'asc' ? 'desc' : 'asc' },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.product.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.product.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }

  find(storeId: string, id: string) {
    return this.prisma.client.product.findUnique({ where: { id, storeId } });
  }

  create(storeId: string, input: CreateProductInput) {
    return this.prisma.client.product.create({
      data: { storeId, name: input.name, sku: input.sku, status: input.status ?? 'DRAFT' },
    });
  }

  update(
    storeId: string,
    id: string,
    input: { [Key in keyof UpdateProductInput]: Exclude<UpdateProductInput[Key], null> },
  ) {
    return this.prisma.client.product.update({ where: { id, storeId }, data: input });
  }

  delete(storeId: string, id: string) {
    return this.prisma.client.product.delete({ where: { id, storeId } });
  }
}
