import { Injectable, NotFoundException } from '@nestjs/common';
import type { DataWindow } from '../../clock/fleet-clock.js';
import { OPEN_TRIP_MAX_HOURS } from '../../fleet-thresholds.js';
import type {
  FleetTrip,
  FleetTripPage,
  FleetTripSortField,
  QueryFleetTripsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  booleanFilter,
  dateTimeRange,
  type FleetScope,
  idList,
  ids,
  numberFilter,
  pagination,
  requireScope,
  searchTokens,
  sortDirection,
  sortField,
  uuid,
} from '../../validation.js';
import { EventsService } from '../events/events.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import {
  type DriverScore,
  type TripCriteria,
  type TripRow,
  TripsRepository,
} from './trips.repository.js';

const SORT_FIELDS: readonly FleetTripSortField[] = ['STARTED_AT', 'DISTANCE_KM', 'DRIVING_SCORE'];
const HOUR_MS = 3_600_000;

/** Whole seconds between start and end; null without an end. */
export function tripDurationSeconds(trip: {
  startedAt: Date;
  endedAt: Date | null;
}): number | null {
  return trip.endedAt === null
    ? null
    : Math.floor((trip.endedAt.getTime() - trip.startedAt.getTime()) / 1000);
}

/** No end and started within `OPEN_TRIP_MAX_HOURS` before the data clock. */
export function tripInProgress(
  trip: { startedAt: Date; endedAt: Date | null },
  asOf: Date | null,
): boolean {
  return (
    trip.endedAt === null &&
    asOf !== null &&
    trip.startedAt.getTime() >= asOf.getTime() - OPEN_TRIP_MAX_HOURS * HOUR_MS
  );
}

function toTrip(row: TripRow, asOf: Date | null, maneuverCount: number): FleetTrip {
  return {
    id: row.id,
    branchId: row.branchId,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    driverId: row.driverId,
    driver: row.driver,
    deviceImei: row.deviceImei,
    source: row.source,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds: tripDurationSeconds(row),
    startAddress: row.startAddress,
    endAddress: row.endAddress,
    startLatitude: row.startLatitude,
    startLongitude: row.startLongitude,
    endLatitude: row.endLatitude,
    endLongitude: row.endLongitude,
    startOdometerKm: row.startOdometerKm,
    endOdometerKm: row.endOdometerKm,
    distanceKm: row.distanceKm,
    idleSeconds: row.idleSeconds,
    maxSpeedKph: row.maxSpeedKph,
    fuelUsedL: row.fuelUsedL,
    drivingScore: row.drivingScore,
    ecoScore: row.ecoScore,
    maneuverCount,
    inProgress: tripInProgress(row, asOf),
    createdAt: row.createdAt,
  };
}

@Injectable()
export class TripsService {
  constructor(
    private readonly trips: TripsRepository,
    private readonly telemetry: TelemetryService,
    private readonly events: EventsService,
  ) {}

  async list(context: RequestContext, args: QueryFleetTripsArgs): Promise<FleetTripPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const period = dateTimeRange(filter?.startedFrom, filter?.startedTo, {
      from: 'startedFrom',
      to: 'startedTo',
    });
    const criteria: TripCriteria = {
      tokens,
      ids: selected,
      startedFrom: period.from,
      startedTo: period.to,
      vehicleIds: idList(filter?.vehicleIds, 'vehicleIds'),
      driverIds: idList(filter?.driverIds, 'driverIds'),
      hasDriver: booleanFilter(filter?.hasDriver, 'hasDriver'),
      scored: booleanFilter(filter?.scored, 'scored'),
      drivingScoreBelow: numberFilter(filter?.drivingScoreBelow, 'drivingScoreBelow', 0, 100),
      hasEnd: booleanFilter(filter?.hasEnd, 'hasEnd'),
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'STARTED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const page = await this.trips.list(scope, { offset, limit }, criteria, sort);
    return {
      items: await this.complete(scope, page.items),
      total: page.total,
      offset,
      limit,
      totalDistanceKm: page.totalDistanceKm,
    };
  }

  async find(context: RequestContext, id: string): Promise<FleetTrip> {
    const scope = requireScope(context);
    const row = await this.trips.find(scope, uuid(id, 'id'));
    if (!row) throw new NotFoundException('Trip not found');
    const [trip] = await this.complete(scope, [row]);
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  /** Distance and trip count per driver ID for trips started in the window. */
  async driverTotals(scope: FleetScope, driverIds: readonly string[], window: DataWindow) {
    if (!driverIds.length) return new Map<string, { distanceKm: number; tripCount: number }>();
    const rows = await this.trips.driverTotals(scope, driverIds, window);
    return new Map(rows.map((row) => [row.driverId, row]));
  }

  driverScore(scope: FleetScope, driverId: string, window: DataWindow): Promise<DriverScore> {
    return this.trips.driverScore(scope, driverId, window);
  }

  /** Attaches `inProgress` (one clock query) and maneuver counts (one grouped query). */
  private async complete(scope: FleetScope, rows: readonly TripRow[]): Promise<FleetTrip[]> {
    if (!rows.length) return [];
    const [asOf, maneuvers] = await Promise.all([
      this.telemetry.asOf(scope),
      this.events.maneuverCountsByTrip(
        scope,
        rows.map((row) => ({ vehicleId: row.vehicleId, tripId: row.id })),
      ),
    ]);
    return rows.map((row) => toTrip(row, asOf, maneuvers.get(row.id) ?? 0));
  }
}
