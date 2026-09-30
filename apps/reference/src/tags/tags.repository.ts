import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CreateReferenceTagInput,
  ReferenceTagSort,
  ReferenceTagSortField,
} from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { lookup } from '../validation.js';

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    storeId: string,
    offset: number,
    limit: number,
    filter?: ReturnType<typeof lookup>,
    sort: Required<ReferenceTagSort> = { field: 'CREATED_AT', direction: 'DESC' },
  ) {
    const where = {
      storeId,
      ...(filter?.search
        ? {
            name: {
              contains: filter.search.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filter?.active !== undefined ? { active: filter.active } : {}),
      ...(filter?.ids ? { id: { in: filter.ids } } : {}),
    };
    const direction = sort.direction === 'ASC' ? 'asc' : 'desc';
    const ordering: Record<ReferenceTagSortField, Prisma.TagOrderByWithRelationInput> = {
      NAME: { name: direction },
      COLOR: { color: direction },
      // Sort by the displayed labels: Active before Inactive in ascending order.
      ACTIVE: { active: direction === 'asc' ? 'desc' : 'asc' },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.tag.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.tag.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(storeId: string, id: string) {
    return this.prisma.client.tag.findUnique({ where: { id, storeId } });
  }
  create(storeId: string, input: CreateReferenceTagInput) {
    return this.prisma.client.tag.create({ data: { ...input, storeId } });
  }
  update(storeId: string, id: string, input: Partial<CreateReferenceTagInput>) {
    return this.prisma.client.tag.update({ where: { id, storeId }, data: input });
  }
  delete(storeId: string, id: string) {
    return this.prisma.client.tag.delete({ where: { id, storeId } });
  }
}
