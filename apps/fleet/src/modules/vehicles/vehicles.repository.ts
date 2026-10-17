import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateFleetVehicleInput,
  FleetVehicleSort,
  FleetVehicleSortField,
} from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    tenantId: string,
    branchId: string,
    offset: number,
    limit: number,
    filter?: { search: string | null; ids: string[] | undefined },
    sort: Required<FleetVehicleSort> = { field: 'CREATED_AT', direction: 'DESC' },
  ) {
    const where = {
      tenantId,
      branchId,
      ...(filter?.search
        ? {
            licensePlate: {
              contains: filter.search.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filter?.ids ? { id: { in: filter.ids } } : {}),
    };
    const direction = sort.direction === 'ASC' ? 'asc' : 'desc';
    const ordering: Record<FleetVehicleSortField, Prisma.VehicleOrderByWithRelationInput> = {
      LICENSE_PLATE: { licensePlate: direction },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.vehicle.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.vehicle.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(tenantId: string, branchId: string, id: string) {
    return this.prisma.client.vehicle.findUnique({ where: { id, tenantId, branchId } });
  }
  create(tenantId: string, branchId: string, input: CreateFleetVehicleInput) {
    return this.prisma.client.vehicle.create({ data: { ...input, tenantId, branchId } });
  }
  update(tenantId: string, branchId: string, id: string, input: Partial<CreateFleetVehicleInput>) {
    return this.prisma.client.vehicle.update({ where: { id, tenantId, branchId }, data: input });
  }
  delete(tenantId: string, branchId: string, id: string) {
    return this.prisma.client.vehicle.delete({ where: { id, tenantId, branchId } });
  }
}
