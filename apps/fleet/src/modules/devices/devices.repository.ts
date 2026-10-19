import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, nullsLast, prismaDirection } from '../../database/search.js';
import type { FleetDeviceSortField } from '../../generated/graphql/types.js';
import type { FleetDeviceModel, FleetDeviceOption } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** The vehicle reference is loaded with every device through the composite relation. */
const deviceInclude = {
  vehicle: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
  },
} satisfies Prisma.DeviceInclude;

export type DeviceRow = Prisma.DeviceGetPayload<{ include: typeof deviceInclude }>;

export interface DeviceData {
  imei: string;
  vehicleId: string;
  model: FleetDeviceModel | null;
  options: FleetDeviceOption[];
  firmwareVersion: string | null;
  simPhoneNumber: string | null;
  simIccid: string | null;
  installedAt: Date | null;
  notes: string | null;
}

/** Validated list arguments; `undefined` means no constraint. */
export interface DeviceListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  models: FleetDeviceModel[] | undefined;
  options: FleetDeviceOption[] | undefined;
  vehicleIds: string[] | undefined;
}

export interface DeviceSort {
  field: FleetDeviceSortField;
  direction: SortDirection;
}

function deviceWhere(scope: FleetScope, criteria: DeviceListCriteria): Prisma.DeviceWhereInput {
  const conditions: Prisma.DeviceWhereInput[] = criteria.tokens.map((token) => {
    const contains = literalContains(token);
    return {
      OR: [
        { imei: contains },
        { firmwareVersion: contains },
        { simPhoneNumber: contains },
        { vehicle: { licensePlate: contains } },
      ],
    };
  });
  if (criteria.ids) {
    conditions.push({ id: { in: criteria.ids } });
  }
  if (criteria.models) {
    conditions.push({ model: { in: criteria.models } });
  }
  if (criteria.options) {
    conditions.push({ options: { hasEvery: criteria.options } });
  }
  if (criteria.vehicleIds) {
    conditions.push({ vehicleId: { in: criteria.vehicleIds } });
  }
  return { tenantId: scope.tenantId, branchId: scope.branchId, AND: conditions };
}

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: DeviceListCriteria,
    sort: DeviceSort,
  ): Promise<{ items: DeviceRow[]; total: number }> {
    const where = deviceWhere(scope, criteria);
    const direction = prismaDirection(sort.direction);
    const ordering: Record<FleetDeviceSortField, Prisma.DeviceOrderByWithRelationInput> = {
      IMEI: { imei: direction },
      INSTALLED_AT: { installedAt: nullsLast(sort.direction) },
      CREATED_AT: { createdAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.device.findMany({
          where,
          include: deviceInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.device.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }

  find(scope: FleetScope, id: string): Promise<DeviceRow | null> {
    return this.prisma.client.device.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }

  findVehicle(scope: FleetScope, id: string) {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
  }

  /** Whether another device of the Branch already uses the IMEI. */
  async imeiTaken(scope: FleetScope, imei: string, excludeId: string | null): Promise<boolean> {
    const row = await this.prisma.client.device.findFirst({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        imei,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return row !== null;
  }

  create(scope: FleetScope, data: DeviceData): Promise<DeviceRow> {
    return this.prisma.client.device.create({
      data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }

  update(scope: FleetScope, id: string, data: Partial<DeviceData>): Promise<DeviceRow> {
    return this.prisma.client.device.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data,
      include: deviceInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<DeviceRow> {
    return this.prisma.client.device.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: deviceInclude,
    });
  }
}
