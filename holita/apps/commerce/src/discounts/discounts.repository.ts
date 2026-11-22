import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { DiscountSort } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

type Fields = Pick<
  Prisma.DiscountCreateInput,
  'code' | 'type' | 'value' | 'enabled' | 'startsAt' | 'endsAt' | 'minSubtotal' | 'usageLimit'
>;

@Injectable()
export class DiscountsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: DiscountSort | null,
  ) {
    const where: Prisma.DiscountWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        code: { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' },
      })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.DiscountOrderByWithRelationInput =
      sort?.field === 'ENABLED' ? { enabled: direction } : { code: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.discount.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
        }),
        this.database.client.discount.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  find(scope: Scope, id: string, tx: Prisma.TransactionClient = this.database.client) {
    return tx.discount.findUnique({ where: { ...scope, id } });
  }

  byCode(tx: Prisma.TransactionClient, scope: Scope, code: string) {
    return tx.discount.findUnique({ where: { tenantId_branchId_code: { ...scope, code } } });
  }

  create(scope: Scope, fields: Fields) {
    return this.database.client.discount.create({ data: { ...scope, ...fields } });
  }

  update(scope: Scope, id: string, fields: Fields) {
    return this.database.client.discount.update({ where: { ...scope, id }, data: fields });
  }

  async lock(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    await tx.$queryRaw`
      SELECT "id" FROM ${this.database.table('discount')}
      WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
        AND "id" = ${id}::uuid
      FOR UPDATE
    `;
  }

  redeem(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return tx.discount.update({
      where: { ...scope, id },
      data: { redeemedCount: { increment: 1 } },
    });
  }
}
