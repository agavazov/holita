import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CreateFleetDeviceInput,
  FleetDeviceSort,
  FleetDeviceSortField,
} from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    tenantId: string,
    storeId: string,
    offset: number,
    limit: number,
    filter?: { search: string | null; ids: string[] | undefined },
    sort: Required<FleetDeviceSort> = { field: 'CREATED_AT', direction: 'DESC' },
  ) {
    const where = {
      tenantId,
      storeId,
      ...(filter?.search
        ? {
            imei: {
              contains: filter.search.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filter?.ids ? { id: { in: filter.ids } } : {}),
    };
    const direction = sort.direction === 'ASC' ? 'asc' : 'desc';
    const ordering: Record<FleetDeviceSortField, Prisma.DeviceOrderByWithRelationInput> = {
      IMEI: { imei: direction },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.device.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.device.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(tenantId: string, storeId: string, id: string) {
    return this.prisma.client.device.findUnique({ where: { id, tenantId, storeId } });
  }
  findVehicle(tenantId: string, storeId: string, id: string) {
    return this.prisma.client.vehicle.findUnique({ where: { id, tenantId, storeId } });
  }
  create(tenantId: string, storeId: string, input: CreateFleetDeviceInput) {
    return this.prisma.client.device.create({ data: { ...input, tenantId, storeId } });
  }
  update(tenantId: string, storeId: string, id: string, input: Partial<CreateFleetDeviceInput>) {
    return this.prisma.client.device.update({ where: { id, tenantId, storeId }, data: input });
  }
  delete(tenantId: string, storeId: string, id: string) {
    return this.prisma.client.device.delete({ where: { id, tenantId, storeId } });
  }
}
