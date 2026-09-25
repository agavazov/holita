import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateProductInput, UpdateProductInput } from '../generated/graphql/types.js';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, offset: number, limit: number, search?: string) {
    const where: Prisma.ProductWhereInput = {
      storeId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.product.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
