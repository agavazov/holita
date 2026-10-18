import { Injectable } from '@nestjs/common';
import type { DataWindow } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, prismaDirection } from '../../database/search.js';
import type { FleetEventSortField } from '../../generated/graphql/types.js';
import type {
  FleetAlertStatus,
  FleetEventKind,
  FleetEventSeverity,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** Stored vehicle and driver references are loaded with every event (no per-row query). */
const eventInclude = {
  vehicle: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
  },
  driver: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, status: true },
  },
} satisfies Prisma.FleetEventInclude;

export type EventRow = Prisma.FleetEventGetPayload<{ include: typeof eventInclude }>;

/** Validated search and filter; `undefined` means no constraint. */
export interface EventCriteria {
  tokens: string[];
  ids: string[] | undefined;
  actionable: boolean | undefined;
  alertStatuses: FleetAlertStatus[] | undefined;
  severities: FleetEventSeverity[] | undefined;
  kinds: FleetEventKind[] | undefined;
  vehicleIds: string[] | undefined;
  driverIds: string[] | undefined;
  tripIds: string[] | undefined;
  occurredFrom: Date | undefined;
  occurredTo: Date | undefined;
}

export interface EventSort {
  field: FleetEventSortField;
  direction: SortDirection;
}

function eventWhere(scope: FleetScope, criteria: EventCriteria): Prisma.FleetEventWhereInput {
  const conditions: Prisma.FleetEventWhereInput[] = criteria.tokens.map((token) => {
    const contains = literalContains(token);
    return {
      OR: [
        { vehicle: { licensePlate: contains } },
        { vehicle: { fleetNumber: contains } },
        { driver: { firstName: contains } },
        { driver: { lastName: contains } },
        { address: contains },
        { troubleCode: contains },
      ],
    };
  });
  if (criteria.ids) conditions.push({ id: { in: criteria.ids } });
  if (criteria.actionable !== undefined)
    conditions.push({ alertStatus: criteria.actionable ? { not: null } : null });
  if (criteria.alertStatuses) conditions.push({ alertStatus: { in: criteria.alertStatuses } });
  if (criteria.severities) conditions.push({ severity: { in: criteria.severities } });
  if (criteria.kinds) conditions.push({ kind: { in: criteria.kinds } });
  if (criteria.vehicleIds) conditions.push({ vehicleId: { in: criteria.vehicleIds } });
  if (criteria.driverIds) conditions.push({ driverId: { in: criteria.driverIds } });
  if (criteria.tripIds) conditions.push({ tripId: { in: criteria.tripIds } });
  if (criteria.occurredFrom) conditions.push({ occurredAt: { gte: criteria.occurredFrom } });
  if (criteria.occurredTo) conditions.push({ occurredAt: { lt: criteria.occurredTo } });
  return { tenantId: scope.tenantId, branchId: scope.branchId, AND: conditions };
}

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: EventCriteria,
    sort: EventSort,
  ): Promise<{ items: EventRow[]; total: number }> {
    const where = eventWhere(scope, criteria);
    const direction = prismaDirection(sort.direction);
    // Severity is a PostgreSQL enum and orders by declaration: INFO < WARNING < CRITICAL.
    const ordering: Record<FleetEventSortField, Prisma.FleetEventOrderByWithRelationInput[]> = {
      OCCURRED_AT: [{ occurredAt: direction }],
      SEVERITY: [{ severity: direction }, { occurredAt: 'desc' }],
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.fleetEvent.findMany({
          where,
          include: eventInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [...ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.fleetEvent.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }

  find(scope: FleetScope, id: string): Promise<EventRow | null> {
    return this.prisma.client.fleetEvent.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: eventInclude,
    });
  }

  /** Actionable events matching the criteria, counted per alert status and severity. */
  async alertCounts(scope: FleetScope, criteria: EventCriteria) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['alertStatus', 'severity'],
      where: { AND: [eventWhere(scope, criteria), { alertStatus: { not: null } }] },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      alertStatus: row.alertStatus,
      severity: row.severity,
      count: row._count._all,
    }));
  }

  /** Events of `kinds` matching the criteria, counted per kind and intensity. */
  async kindIntensityCounts(
    scope: FleetScope,
    criteria: EventCriteria,
    kinds: readonly FleetEventKind[],
  ) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['kind', 'intensity'],
      where: { AND: [eventWhere(scope, criteria), { kind: { in: [...kinds] } }] },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      kind: row.kind,
      intensity: row.intensity,
      count: row._count._all,
    }));
  }

  /** Events of `kinds` of one driver with `occurredAt` in `(start, end]`, per kind and intensity. */
  async driverKindIntensityCounts(
    scope: FleetScope,
    driverId: string,
    kinds: readonly FleetEventKind[],
    window: DataWindow,
  ) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['kind', 'intensity'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        driverId,
        kind: { in: [...kinds] },
        occurredAt: { gt: window.start, lte: window.end },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      kind: row.kind,
      intensity: row.intensity,
      count: row._count._all,
    }));
  }

  /** OPEN alerts per vehicle. */
  async openAlertCounts(scope: FleetScope, vehicleIds: readonly string[]) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['vehicleId'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId: { in: [...vehicleIds] },
        alertStatus: 'OPEN',
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({ vehicleId: row.vehicleId, count: row._count._all }));
  }

  /** Events of `kinds` per trip; the vehicle IDs let the (vehicle, trip) index serve it. */
  async countsByTrip(
    scope: FleetScope,
    trips: readonly { vehicleId: string; tripId: string }[],
    kinds: readonly FleetEventKind[],
  ) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['tripId'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId: { in: [...new Set(trips.map((trip) => trip.vehicleId))] },
        tripId: { in: trips.map((trip) => trip.tripId) },
        kind: { in: [...kinds] },
      },
      _count: { _all: true },
    });
    return rows.flatMap((row) =>
      row.tripId === null ? [] : [{ tripId: row.tripId, count: row._count._all }],
    );
  }

  /** Events of `kinds` per driver with `occurredAt` in `(start, end]`. */
  async countsByDriver(
    scope: FleetScope,
    driverIds: readonly string[],
    kinds: readonly FleetEventKind[],
    window: DataWindow,
  ) {
    const rows = await this.prisma.client.fleetEvent.groupBy({
      by: ['driverId'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        driverId: { in: [...driverIds] },
        kind: { in: [...kinds] },
        occurredAt: { gt: window.start, lte: window.end },
      },
      _count: { _all: true },
    });
    return rows.flatMap((row) =>
      row.driverId === null ? [] : [{ driverId: row.driverId, count: row._count._all }],
    );
  }

  /** Conditional state change: only applies while the alert still has `expected`. */
  async transition(
    scope: FleetScope,
    id: string,
    expected: FleetAlertStatus,
    data: Prisma.FleetEventUpdateManyMutationInput,
  ): Promise<number> {
    const { count } = await this.prisma.client.fleetEvent.updateMany({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId, alertStatus: expected },
      data,
    });
    return count;
  }
}
