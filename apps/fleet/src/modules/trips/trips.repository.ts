import { Injectable } from '@nestjs/common';
import type { DataWindow } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, nullsLast, prismaDirection } from '../../database/search.js';
import { fleetTable, integer, number, numberOrNull, rowsOf } from '../../database/sql.js';
import { SCORE_MIN_DISTANCE_KM } from '../../fleet-thresholds.js';
import type { FleetTripSortField } from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';

/** Stored vehicle and driver references are loaded with every trip (no per-row query). */
const tripInclude = {
  vehicle: {
    select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
  },
  driver: {
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, status: true },
  },
} satisfies Prisma.TripInclude;

export type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

/** Validated search and filter; `undefined` means no constraint. */
export interface TripCriteria {
  tokens: string[];
  ids: string[] | undefined;
  startedFrom: Date | undefined;
  startedTo: Date | undefined;
  vehicleIds: string[] | undefined;
  driverIds: string[] | undefined;
  hasDriver: boolean | undefined;
  scored: boolean | undefined;
  drivingScoreBelow: number | undefined;
  hasEnd: boolean | undefined;
}

export interface TripSort {
  field: FleetTripSortField;
  direction: SortDirection;
}

/** Totals of one driver's trips in a window; averages are distance-weighted. */
export interface DriverScore {
  tripCount: number;
  distanceKm: number;
  scoredTripCount: number;
  averageDrivingScore: number | null;
  averageEcoScore: number | null;
}

function tripWhere(scope: FleetScope, criteria: TripCriteria): Prisma.TripWhereInput {
  const conditions: Prisma.TripWhereInput[] = criteria.tokens.map((token) => {
    const contains = literalContains(token);
    return {
      OR: [
        { vehicle: { licensePlate: contains } },
        { vehicle: { fleetNumber: contains } },
        { driver: { firstName: contains } },
        { driver: { lastName: contains } },
        { startAddress: contains },
        { endAddress: contains },
      ],
    };
  });
  if (criteria.ids) {
    conditions.push({ id: { in: criteria.ids } });
  }
  if (criteria.startedFrom) {
    conditions.push({ startedAt: { gte: criteria.startedFrom } });
  }
  if (criteria.startedTo) {
    conditions.push({ startedAt: { lt: criteria.startedTo } });
  }
  if (criteria.vehicleIds) {
    conditions.push({ vehicleId: { in: criteria.vehicleIds } });
  }
  if (criteria.driverIds) {
    conditions.push({ driverId: { in: criteria.driverIds } });
  }
  if (criteria.hasDriver !== undefined) {
    conditions.push({ driverId: criteria.hasDriver ? { not: null } : null });
  }
  if (criteria.scored !== undefined) {
    conditions.push({ drivingScore: criteria.scored ? { not: null } : null });
  }
  // `lt` never matches null, so a score threshold also selects scored trips only.
  if (criteria.drivingScoreBelow !== undefined) {
    conditions.push({ drivingScore: { lt: criteria.drivingScoreBelow } });
  }
  if (criteria.hasEnd !== undefined) {
    conditions.push({ endedAt: criteria.hasEnd ? { not: null } : null });
  }
  return { tenantId: scope.tenantId, branchId: scope.branchId, AND: conditions };
}

function parseDriverScore(row: Record<string, unknown>): DriverScore {
  return {
    tripCount: integer(row, 'tripCount'),
    distanceKm: number(row, 'distanceKm'),
    scoredTripCount: integer(row, 'scoredTripCount'),
    averageDrivingScore: numberOrNull(row, 'averageDrivingScore'),
    averageEcoScore: numberOrNull(row, 'averageEcoScore'),
  };
}

@Injectable()
export class TripsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: TripCriteria,
    sort: TripSort,
  ): Promise<{ items: TripRow[]; total: number; totalDistanceKm: number }> {
    const where = tripWhere(scope, criteria);
    const direction = prismaDirection(sort.direction);
    const ordering: Record<FleetTripSortField, Prisma.TripOrderByWithRelationInput[]> = {
      STARTED_AT: [{ startedAt: direction }],
      DISTANCE_KM: [{ distanceKm: nullsLast(sort.direction) }, { startedAt: 'desc' }],
      DRIVING_SCORE: [{ drivingScore: nullsLast(sort.direction) }, { startedAt: 'desc' }],
    };
    const [items, total, totals] = await this.prisma.client.$transaction(
      [
        this.prisma.client.trip.findMany({
          where,
          include: tripInclude,
          skip: page.offset,
          take: page.limit,
          orderBy: [...ordering[sort.field], { id: 'desc' }],
        }),
        this.prisma.client.trip.count({ where }),
        this.prisma.client.trip.aggregate({ where, _sum: { distanceKm: true } }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, totalDistanceKm: totals._sum.distanceKm ?? 0 };
  }

  find(scope: FleetScope, id: string): Promise<TripRow | null> {
    return this.prisma.client.trip.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      include: tripInclude,
    });
  }

  /** Σ non-null distance and trip count per driver for trips started in `(start, end]`. */
  async driverTotals(scope: FleetScope, driverIds: readonly string[], window: DataWindow) {
    const rows = await this.prisma.client.trip.groupBy({
      by: ['driverId'],
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        driverId: { in: [...driverIds] },
        startedAt: { gt: window.start, lte: window.end },
      },
      _sum: { distanceKm: true },
      _count: { _all: true },
    });
    return rows.flatMap((row) =>
      row.driverId === null
        ? []
        : [
            {
              driverId: row.driverId,
              distanceKm: row._sum.distanceKm ?? 0,
              tripCount: row._count._all,
            },
          ],
    );
  }

  /**
   * One driver's trips started in `(start, end]`: count, distance, scored trips and the
   * distance-weighted scores over scored trips of at least `SCORE_MIN_DISTANCE_KM`.
   */
  async driverScore(scope: FleetScope, driverId: string, window: DataWindow): Promise<DriverScore> {
    const { tenantId, branchId } = scope;
    const trips = fleetTable(this.prisma.schema, 'Trip');
    const minimum = SCORE_MIN_DISTANCE_KM;
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT count(*)::int AS "tripCount",
        coalesce(sum(t."distanceKm"), 0)::float8 AS "distanceKm",
        count(t."drivingScore")::int AS "scoredTripCount",
        (sum(t."drivingScore" * t."distanceKm")
            FILTER (WHERE t."drivingScore" IS NOT NULL AND t."distanceKm" >= ${minimum}::float8)
          / nullif(sum(t."distanceKm")
            FILTER (WHERE t."drivingScore" IS NOT NULL AND t."distanceKm" >= ${minimum}::float8), 0)
        )::float8 AS "averageDrivingScore",
        (sum(t."ecoScore" * t."distanceKm")
            FILTER (WHERE t."ecoScore" IS NOT NULL AND t."distanceKm" >= ${minimum}::float8)
          / nullif(sum(t."distanceKm")
            FILTER (WHERE t."ecoScore" IS NOT NULL AND t."distanceKm" >= ${minimum}::float8), 0)
        )::float8 AS "averageEcoScore"
      FROM ${trips} t
      WHERE t."tenantId" = ${tenantId}::uuid AND t."branchId" = ${branchId}::uuid
        AND t."driverId" = ${driverId}::uuid
        AND t."startedAt" > ${window.start}::timestamptz AND t."startedAt" <= ${window.end}::timestamptz`);
    const [score] = rowsOf(rows, parseDriverScore);
    if (!score) {
      throw new Error('Missing driver score aggregate');
    }
    return score;
  }
}
