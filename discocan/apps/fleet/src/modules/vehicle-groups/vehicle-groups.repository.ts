import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, prismaDirection } from '../../database/search.js';
import type { FleetVehicleGroupSortField } from '../../generated/graphql/types.js';
import type { FleetGroupColor } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** Vehicle count (any status) is loaded with every group. */
const groupInclude = {
  _count: { select: { vehicles: true } },
} satisfies Prisma.VehicleGroupInclude;

export type VehicleGroupRow = Prisma.VehicleGroupGetPayload<{ include: typeof groupInclude }>;

export interface VehicleGroupData {
  name: string;
  description: string | null;
  colorToken: FleetGroupColor;
}

export interface VehicleGroupListCriteria {
  tokens: string[];
  ids: string[] | undefined;
}

export interface VehicleGroupSort {
  field: FleetVehicleGroupSortField;
  direction: SortDirection;
}

@Injectable()
export class VehicleGroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The page, its total and the Branch's ungrouped vehicle count in one snapshot. */
  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: VehicleGroupListCriteria,
    sort: VehicleGroupSort,
  ): Promise<{ items: VehicleGroupRow[]; total: number; ungroupedVehicleCount: number }> {
    const conditions: Prisma.VehicleGroupWhereInput[] = criteria.tokens.map((token) => {
      const contains = literalContains(token);
      return { OR: [{ name: contains }, { description: contains }] };
    });
    if (criteria.ids) {
      conditions.push({ id: { in: criteria.ids } });
    }
    const where: Prisma.VehicleGroupWhereInput = {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      AND: conditions,
    };
    const direction = prismaDirection(sort.direction);
    const ordering: Record<
      FleetVehicleGroupSortField,
      Prisma.VehicleGroupOrderByWithRelationInput
    > = { NAME: { name: direction }, CREATED_AT: { createdAt: direction } };
    const [items, total, ungroupedVehicleCount] = await this.prisma.client.$transaction(
      [
        this.prisma.client.vehicleGroup.findMany({
          where,
          include: groupInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.vehicleGroup.count({ where }),
        this.prisma.client.vehicle.count({
          where: { tenantId: scope.tenantId, branchId: scope.branchId, groupId: null },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, ungroupedVehicleCount };
  }

  find(scope: FleetScope, id: string): Promise<VehicleGroupRow | null> {
    return this.prisma.client.vehicleGroup.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: groupInclude,
    });
  }

  /** Whether another group of the Branch already uses the exact name. */
  async nameTaken(scope: FleetScope, name: string, excludeId: string | null): Promise<boolean> {
    const row = await this.prisma.client.vehicleGroup.findFirst({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        name,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return row !== null;
  }

  create(scope: FleetScope, data: VehicleGroupData): Promise<VehicleGroupRow> {
    return this.prisma.client.vehicleGroup.create({
      data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
      include: groupInclude,
    });
  }

  update(scope: FleetScope, id: string, data: Partial<VehicleGroupData>): Promise<VehicleGroupRow> {
    return this.prisma.client.vehicleGroup.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data,
      include: groupInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<VehicleGroupRow> {
    return this.prisma.client.vehicleGroup.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: groupInclude,
    });
  }
}
