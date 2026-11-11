import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import {
  type GeoZoneShape,
  type PositionSample,
  stateKey,
  storedRing,
  type ZoneState,
  type ZoneTransition,
} from './geo-zone-geometry.js';

export interface GeoZoneEventQuery {
  readonly vehicleIds: string[] | null;
  readonly zoneIds: string[] | null;
  readonly kinds: ('ENTER' | 'EXIT')[] | null;
  readonly occurredFrom: Date | null;
  readonly occurredTo: Date | null;
  readonly offset: number;
  readonly limit: number;
}

export interface SampleCursor {
  readonly sampleCreatedAt: Date;
  readonly sampleId: string;
}

const EVENT_INCLUDE = {
  zone: { select: { id: true, name: true } },
  vehicle: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
  },
} satisfies Prisma.GeoZoneEventInclude;

@Injectable()
export class GeoZonesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async zones(scope: FleetScope): Promise<(GeoZoneShape & { name: string })[]> {
    const rows = await this.prisma.client.geoZone.findMany({
      where: { tenantId: scope.tenantId, branchId: scope.branchId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({ ...row, ring: storedRing(row.polygon) }));
  }

  async events(scope: FleetScope, query: GeoZoneEventQuery) {
    const where: Prisma.GeoZoneEventWhereInput = {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      ...(query.vehicleIds ? { vehicleId: { in: query.vehicleIds } } : {}),
      ...(query.zoneIds ? { zoneId: { in: query.zoneIds } } : {}),
      ...(query.kinds ? { kind: { in: query.kinds } } : {}),
      occurredAt: {
        ...(query.occurredFrom ? { gte: query.occurredFrom } : {}),
        ...(query.occurredTo ? { lte: query.occurredTo } : {}),
      },
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.geoZoneEvent.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.client.geoZoneEvent.count({ where }),
    ]);
    return { items, total };
  }

  /** Branches with at least one zone, across all Tenants. */
  async zoneScopes(): Promise<FleetScope[]> {
    return this.prisma.client.geoZone.findMany({
      distinct: ['tenantId', 'branchId'],
      select: { tenantId: true, branchId: true },
      orderBy: [{ tenantId: 'asc' }, { branchId: 'asc' }],
    });
  }

  async cursor(scope: FleetScope): Promise<SampleCursor | null> {
    return this.prisma.client.geoZoneCursor.findUnique({
      where: { tenantId_branchId: { tenantId: scope.tenantId, branchId: scope.branchId } },
      select: { sampleCreatedAt: true, sampleId: true },
    });
  }

  /** Positioned samples recorded since `since`, after the cursor in insertion order. */
  async samples(
    scope: FleetScope,
    after: SampleCursor | null,
    since: Date,
    take: number,
  ): Promise<(PositionSample & { createdAt: Date })[]> {
    const rows = await this.prisma.client.vehicleStatusSample.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        latitude: { not: null },
        longitude: { not: null },
        recordedAt: { gte: since },
        ...(after
          ? {
              OR: [
                { createdAt: { gt: after.sampleCreatedAt } },
                { createdAt: after.sampleCreatedAt, id: { gt: after.sampleId } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        vehicleId: true,
        recordedAt: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
    return rows.flatMap((row) =>
      row.latitude === null || row.longitude === null
        ? []
        : [{ ...row, latitude: row.latitude, longitude: row.longitude }],
    );
  }

  /** The last event of each vehicle and zone. */
  async states(scope: FleetScope, vehicleIds: readonly string[]): Promise<Map<string, ZoneState>> {
    const rows = await this.prisma.client.geoZoneEvent.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId: { in: [...vehicleIds] },
      },
      distinct: ['vehicleId', 'zoneId'],
      select: { vehicleId: true, zoneId: true, kind: true, occurredAt: true },
      orderBy: [{ vehicleId: 'asc' }, { zoneId: 'asc' }, { occurredAt: 'desc' }],
    });
    return new Map(
      rows.map((row) => [
        stateKey(row.vehicleId, row.zoneId),
        { kind: row.kind, occurredAt: row.occurredAt },
      ]),
    );
  }

  async save(
    scope: FleetScope,
    transitions: readonly ZoneTransition[],
    cursor: SampleCursor,
  ): Promise<number> {
    const [created] = await this.prisma.client.$transaction([
      this.prisma.client.geoZoneEvent.createMany({
        data: transitions.map((transition) => ({ ...scope, ...transition })),
        skipDuplicates: true,
      }),
      this.prisma.client.geoZoneCursor.upsert({
        where: { tenantId_branchId: { tenantId: scope.tenantId, branchId: scope.branchId } },
        create: { ...scope, ...cursor },
        update: cursor,
      }),
    ]);
    return created.count;
  }
}
