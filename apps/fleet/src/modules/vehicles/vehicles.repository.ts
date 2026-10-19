import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, nullsLast, prismaDirection } from '../../database/search.js';
import type { FleetVehicleSortField } from '../../generated/graphql/types.js';
import type {
  FleetFuelType,
  FleetVehicleStatus,
  FleetVehicleType,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** Stored references and the device count are loaded with every vehicle (no per-row query). */
const vehicleInclude = {
  group: { select: { id: true, name: true, colorToken: true } },
  currentDriver: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, status: true },
  },
  _count: { select: { devices: true } },
} satisfies Prisma.VehicleInclude;

export type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;

export interface VehicleData {
  licensePlate: string;
  notes: string | null;
  fleetNumber: string | null;
  vehicleType: FleetVehicleType | null;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  vin: string | null;
  fuelType: FleetFuelType | null;
  fuelTankCapacityL: number | null;
  status: FleetVehicleStatus;
  groupId: string | null;
  currentDriverId: string | null;
}

/** Validated list arguments; `undefined` means no constraint. */
export interface VehicleListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  statuses: FleetVehicleStatus[] | undefined;
  vehicleTypes: FleetVehicleType[] | undefined;
  fuelTypes: FleetFuelType[] | undefined;
  groupIds: string[] | undefined;
  hasGroup: boolean | undefined;
  currentDriverIds: string[] | undefined;
  hasDriver: boolean | undefined;
  hasDevice: boolean | undefined;
  hasOpenAlerts: boolean | undefined;
}

export interface VehicleSort {
  field: FleetVehicleSortField;
  direction: SortDirection;
}

function vehicleWhere(scope: FleetScope, criteria: VehicleListCriteria): Prisma.VehicleWhereInput {
  const conditions: Prisma.VehicleWhereInput[] = criteria.tokens.map((token) => {
    const contains = literalContains(token);
    return {
      OR: [
        { licensePlate: contains },
        { fleetNumber: contains },
        { vin: contains },
        { make: contains },
        { model: contains },
      ],
    };
  });
  if (criteria.ids) {
    conditions.push({ id: { in: criteria.ids } });
  }
  if (criteria.statuses) {
    conditions.push({ status: { in: criteria.statuses } });
  }
  if (criteria.vehicleTypes) {
    conditions.push({ vehicleType: { in: criteria.vehicleTypes } });
  }
  if (criteria.fuelTypes) {
    conditions.push({ fuelType: { in: criteria.fuelTypes } });
  }
  if (criteria.groupIds) {
    conditions.push({ groupId: { in: criteria.groupIds } });
  }
  if (criteria.hasGroup !== undefined) {
    conditions.push({ groupId: criteria.hasGroup ? { not: null } : null });
  }
  if (criteria.currentDriverIds) {
    conditions.push({ currentDriverId: { in: criteria.currentDriverIds } });
  }
  if (criteria.hasDriver !== undefined) {
    conditions.push({ currentDriverId: criteria.hasDriver ? { not: null } : null });
  }
  if (criteria.hasDevice !== undefined) {
    conditions.push({ devices: criteria.hasDevice ? { some: {} } : { none: {} } });
  }
  if (criteria.hasOpenAlerts !== undefined) {
    const open = { alertStatus: 'OPEN' } satisfies Prisma.FleetEventWhereInput;
    conditions.push({ events: criteria.hasOpenAlerts ? { some: open } : { none: open } });
  }
  return { tenantId: scope.tenantId, branchId: scope.branchId, AND: conditions };
}

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: VehicleListCriteria,
    sort: VehicleSort,
  ): Promise<{ items: VehicleRow[]; total: number }> {
    const where = vehicleWhere(scope, criteria);
    const direction = prismaDirection(sort.direction);
    const ordering: Record<FleetVehicleSortField, Prisma.VehicleOrderByWithRelationInput> = {
      LICENSE_PLATE: { licensePlate: direction },
      FLEET_NUMBER: { fleetNumber: nullsLast(sort.direction) },
      CREATED_AT: { createdAt: direction },
      UPDATED_AT: { updatedAt: direction },
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.vehicle.findMany({
          where,
          include: vehicleInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.vehicle.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }

  find(scope: FleetScope, id: string): Promise<VehicleRow | null> {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: vehicleInclude,
    });
  }

  findGroup(scope: FleetScope, id: string) {
    return this.prisma.client.vehicleGroup.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
  }

  findDriver(scope: FleetScope, id: string) {
    return this.prisma.client.driver.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true, status: true },
    });
  }

  /** Stored values among `fleetNumber`/`vin` already used by another vehicle of the Branch. */
  async duplicates(
    scope: FleetScope,
    values: { fleetNumber: string | null; vin: string | null },
    excludeId: string | null,
  ): Promise<{ fleetNumber: boolean; vin: boolean }> {
    const candidates: Prisma.VehicleWhereInput[] = [];
    if (values.fleetNumber !== null) {
      candidates.push({ fleetNumber: values.fleetNumber });
    }
    if (values.vin !== null) {
      candidates.push({ vin: values.vin });
    }
    if (!candidates.length) {
      return { fleetNumber: false, vin: false };
    }
    const rows = await this.prisma.client.vehicle.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
        OR: candidates,
      },
      select: { fleetNumber: true, vin: true },
      take: 2,
    });
    return {
      fleetNumber:
        values.fleetNumber !== null && rows.some((row) => row.fleetNumber === values.fleetNumber),
      vin: values.vin !== null && rows.some((row) => row.vin === values.vin),
    };
  }

  create(scope: FleetScope, data: VehicleData): Promise<VehicleRow> {
    return this.prisma.client.vehicle.create({
      data: { ...data, tenantId: scope.tenantId, branchId: scope.branchId },
      include: vehicleInclude,
    });
  }

  update(scope: FleetScope, id: string, data: Partial<VehicleData>): Promise<VehicleRow> {
    return this.prisma.client.vehicle.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data,
      include: vehicleInclude,
    });
  }

  /** Sets INACTIVE and clears the current driver in one scoped update. */
  deactivate(scope: FleetScope, id: string): Promise<VehicleRow> {
    return this.prisma.client.vehicle.update({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      data: { status: 'INACTIVE', currentDriverId: null },
      include: vehicleInclude,
    });
  }

  delete(scope: FleetScope, id: string): Promise<VehicleRow> {
    return this.prisma.client.vehicle.delete({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: vehicleInclude,
    });
  }
}
