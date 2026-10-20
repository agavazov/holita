import { Injectable } from '@nestjs/common';
import type { DataWindow } from '../../clock/fleet-clock.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  dateOrNull,
  fleetTable,
  integer,
  number,
  numberOrNull,
  rowsOf,
  text,
} from '../../database/sql.js';
import { SCORE_MIN_DISTANCE_KM } from '../../fleet-thresholds.js';
import type {
  FleetTripDrivingEvent,
  FleetTripSortField,
  FleetTripSummary,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope, SortDirection } from '../../validation.js';
import { MANEUVER_KINDS } from '../events/events.service.js';
import { vehicleDataClockSql } from '../telemetry/vehicle-facts.sql.js';
import type { TripConditionCriteria } from './trip-filter.js';
import { tripListOrderSql, tripListRowsSql, tripListWhereSql } from './trip-list.sql.js';

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
export type TripListRow = TripRow & { drivingEvents: FleetTripDrivingEvent[] };

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
  allOf?: TripConditionCriteria[] | undefined;
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
  ): Promise<{
    items: TripListRow[];
    total: number;
    totalDistanceKm: number;
    dataAsOf: Date | null;
  }> {
    const base = tripListRowsSql(this.prisma.schema, scope);
    const where = tripListWhereSql(this.prisma.schema, scope, criteria);
    const order = tripListOrderSql(sort);
    return this.prisma.client.$transaction(
      async (transaction) => {
        const selected: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH trips AS (${base}) SELECT t."id"::text AS "id" FROM trips t
          WHERE ${where} ORDER BY ${order} LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const counted: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH trips AS (${base}), clock AS (${vehicleDataClockSql(this.prisma.schema, scope)})
          SELECT count(*)::int AS "total",
            coalesce(sum(t."distanceKm"), 0)::float8 AS "totalDistanceKm",
            (SELECT "asOf" FROM clock) AS "dataAsOf"
          FROM trips t WHERE ${where}`);
        const ids = rowsOf(selected, (row) => text(row, 'id'));
        const [totals] = rowsOf(counted, (row) => ({
          total: integer(row, 'total'),
          totalDistanceKm: number(row, 'totalDistanceKm'),
          dataAsOf: dateOrNull(row, 'dataAsOf'),
        }));
        if (!totals) {
          throw new Error('Missing trip list aggregate.');
        }
        const rows = ids.length
          ? await transaction.trip.findMany({
              where: { tenantId: scope.tenantId, branchId: scope.branchId, id: { in: ids } },
              include: {
                ...tripInclude,
                events: {
                  where: {
                    tenantId: scope.tenantId,
                    branchId: scope.branchId,
                    kind: { in: [...MANEUVER_KINDS] },
                  },
                  select: { id: true, occurredAt: true, kind: true, severity: true, details: true },
                  orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
                },
              },
            })
          : [];
        const byId = new Map(rows.map((row) => [row.id, row]));
        const items = ids.map((id) => {
          const row = byId.get(id);
          if (!row) {
            throw new Error('Missing trip in the list snapshot.');
          }
          const { events, ...trip } = row;
          return { ...trip, drivingEvents: events };
        });
        return { items, ...totals };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Whole-Branch totals, with an arithmetic mean of non-null device trip scores. */
  async summary(scope: FleetScope): Promise<FleetTripSummary> {
    const base = tripListRowsSql(this.prisma.schema, scope);
    const events = fleetTable(this.prisma.schema, 'FleetEvent');
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH trips AS (${base})
      SELECT count(*)::int AS "totalTrips",
        coalesce(sum(t."distanceKm"), 0)::float8 AS "distanceKm",
        coalesce(sum(t."durationSeconds"), 0)::float8 AS "totalDurationSeconds",
        avg(t."drivingScore")::float8 AS "averageDrivingScore",
        (SELECT count(*)::int FROM ${events} e
          WHERE e."tenantId" = ${scope.tenantId}::uuid AND e."branchId" = ${scope.branchId}::uuid
            AND e."kind"::text = ANY(${MANEUVER_KINDS}::text[])
            AND EXISTS (SELECT 1 FROM trips attached
              WHERE attached."id" = e."tripId" AND attached."vehicleId" = e."vehicleId")
        ) AS "totalManeuverEvents"
      FROM trips t`);
    const [summary] = rowsOf(rows, (row) => ({
      totalTrips: integer(row, 'totalTrips'),
      distanceKm: number(row, 'distanceKm'),
      totalDurationSeconds: integer(row, 'totalDurationSeconds'),
      averageDrivingScore: numberOrNull(row, 'averageDrivingScore'),
      totalManeuverEvents: integer(row, 'totalManeuverEvents'),
    }));
    if (!summary) {
      throw new Error('Missing trip summary.');
    }
    return summary;
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
