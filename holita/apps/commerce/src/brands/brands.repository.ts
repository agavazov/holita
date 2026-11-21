import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { BrandInput, BrandSort } from '../generated/graphql/types.js';
import type { Scope } from '../scope.js';

type BrandFields = Pick<BrandInput, 'name' | 'slug' | 'status'>;

@Injectable()
export class BrandsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: BrandSort | null,
  ) {
    const where: Prisma.BrandWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { slug: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.BrandOrderByWithRelationInput =
      sort?.field === 'SLUG'
        ? { slug: direction }
        : sort?.field === 'STATUS'
          ? { status: direction }
          : { name: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.brand.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
        }),
        this.database.client.brand.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  active(scope: Scope, offset: number, limit: number) {
    return this.database.client.brand.findMany({
      where: { ...scope, status: 'ACTIVE' },
      skip: offset,
      take: limit,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.brand.findUnique({ where: { ...scope, id } });
  }

  logo(scope: Scope, logoKey: string, publicOnly: boolean) {
    return this.database.client.brand.findUnique({
      where: {
        tenantId_branchId_logoKey: { ...scope, logoKey },
        ...(publicOnly ? { status: 'ACTIVE' } : {}),
      },
      select: { id: true },
    });
  }

  create(scope: Scope, fields: BrandFields, logoKey: string | null) {
    return this.database.client.brand.create({ data: { ...scope, ...fields, logoKey } });
  }

  update(
    scope: Scope,
    id: string,
    fields: BrandFields,
    logoKey?: string | null,
    previousLogoKey?: string | null,
  ) {
    return this.database.client.brand.update({
      where: {
        ...scope,
        id,
        ...(previousLogoKey === undefined ? {} : { logoKey: previousLogoKey }),
      },
      data: { ...fields, ...(logoKey === undefined ? {} : { logoKey }) },
    });
  }

  delete(scope: Scope, id: string) {
    return this.database.client.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { ...scope, brandId: id }, data: { brandId: null } });
      return tx.brand.delete({ where: { ...scope, id } });
    });
  }
}
