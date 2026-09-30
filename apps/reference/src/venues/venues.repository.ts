import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CreateReferenceVenueInput,
  ReferenceVenueSort,
  ReferenceVenueSortField,
} from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { lookup } from '../validation.js';

@Injectable()
export class VenuesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    storeId: string,
    offset: number,
    limit: number,
    filter?: ReturnType<typeof lookup>,
    sort: Required<ReferenceVenueSort> = { field: 'CREATED_AT', direction: 'DESC' },
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
    const ordering: Record<ReferenceVenueSortField, Prisma.VenueOrderByWithRelationInput> = {
      NAME: { name: direction },
      CITY: { city: direction },
      COUNTRY_CODE: { countryCode: direction },
      CAPACITY: { capacity: { sort: direction, nulls: 'last' } },
      // Sort by the displayed labels: Active before Inactive in ascending order.
      ACTIVE: { active: direction === 'asc' ? 'desc' : 'asc' },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.venue.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.venue.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(storeId: string, id: string) {
    return this.prisma.client.venue.findUnique({ where: { id, storeId } });
  }
  create(storeId: string, input: CreateReferenceVenueInput) {
    return this.prisma.client.venue.create({ data: { ...input, storeId } });
  }
  update(storeId: string, id: string, input: Partial<CreateReferenceVenueInput>) {
    return this.prisma.client.venue.update({ where: { id, storeId }, data: input });
  }
  delete(storeId: string, id: string) {
    return this.prisma.client.venue.delete({ where: { id, storeId } });
  }
}
