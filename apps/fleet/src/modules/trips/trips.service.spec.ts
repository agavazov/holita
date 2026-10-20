import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { FleetTripDrivingEvent } from '../../generated/graphql/types.js';
import { EventsService } from '../events/events.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { type TripRow, TripsRepository } from './trips.repository.js';
import { tripDurationSeconds, tripInProgress, TripsService } from './trips.service.js';

async function fieldErrors(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    if (!(error instanceof BadRequestException)) {
      throw error;
    }
    const response = error.getResponse();
    return typeof response === 'object' && 'fieldErrors' in response
      ? response.fieldErrors
      : undefined;
  }
  throw new Error('Expected BAD_USER_INPUT');
}

const HOUR = 3_600_000;
const asOf = new Date('2026-10-18T06:30:00.000Z');

describe('Trip derived values', () => {
  it('computes whole-second durations only for ended trips', () => {
    const startedAt = new Date('2026-10-17T21:10:00.000Z');
    expect(tripDurationSeconds({ startedAt, endedAt: new Date('2026-10-18T04:40:00.999Z') })).toBe(
      27_000,
    );
    expect(tripDurationSeconds({ startedAt, endedAt: startedAt })).toBe(0);
    expect(tripDurationSeconds({ startedAt, endedAt: null })).toBeNull();
  });

  it('marks open trips in progress only from 24 h before up to the data clock', () => {
    const started = (offset: number) => new Date(asOf.getTime() + offset);
    expect(tripInProgress({ startedAt: started(-24 * HOUR), endedAt: null }, asOf)).toBe(true);
    expect(tripInProgress({ startedAt: started(-24 * HOUR - 1), endedAt: null }, asOf)).toBe(false);
    expect(tripInProgress({ startedAt: started(0), endedAt: null }, asOf)).toBe(true);
    expect(tripInProgress({ startedAt: started(1), endedAt: null }, asOf)).toBe(false);
    expect(tripInProgress({ startedAt: started(-HOUR), endedAt: asOf }, asOf)).toBe(false);
    expect(tripInProgress({ startedAt: started(-HOUR), endedAt: null }, null)).toBe(false);
  });
});

describe('Trips list contract', () => {
  const list = jest.fn<TripsRepository['list']>();
  const find = jest.fn<TripsRepository['find']>();
  const summary = jest.fn<TripsRepository['summary']>();
  const telemetryAsOf = jest.fn<TelemetryService['asOf']>();
  const drivingEventsByTrip = jest.fn<EventsService['drivingEventsByTrip']>();
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const vehicleId = randomUUID(),
    driverId = randomUUID();
  function row(overrides: Partial<TripRow> = {}): TripRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      vehicleId,
      driverId: null,
      deviceImei: '990601000000001',
      source: 'DEMO',
      startedAt: new Date(asOf.getTime() - 2 * HOUR),
      endedAt: null,
      startAddress: null,
      endAddress: null,
      startLatitude: null,
      startLongitude: null,
      endLatitude: null,
      endLongitude: null,
      startOdometerKm: null,
      endOdometerKm: null,
      distanceKm: null,
      idleSeconds: null,
      maxSpeedKph: null,
      fuelUsedL: null,
      drivingScore: null,
      ecoScore: null,
      createdAt: asOf,
      vehicle: {
        id: vehicleId,
        licensePlate: 'CB 1001 AX',
        fleetNumber: 'Т-01',
        vehicleType: 'TRACTOR',
        status: 'ACTIVE',
      },
      driver: null,
      ...overrides,
    };
  }
  let service: TripsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: TripsRepository, useValue: { list, find, summary } },
        { provide: TelemetryService, useValue: { asOf: telemetryAsOf } },
        { provide: EventsService, useValue: { drivingEventsByTrip } },
      ],
    }).compile();
    service = module.get(TripsService);
    telemetryAsOf.mockResolvedValue(asOf);
    drivingEventsByTrip.mockResolvedValue(new Map());
    list.mockResolvedValue({ items: [], total: 0, totalDistanceKm: 0, dataAsOf: null });
  });

  it('maps every filter, the default sort and the page aggregate', async () => {
    const open = row(),
      ended = row({ endedAt: asOf, distanceKm: 12.5 });
    const events: FleetTripDrivingEvent[] = Array.from({ length: 4 }, (_, index) => ({
      id: randomUUID(),
      occurredAt: new Date(asOf.getTime() - (4 - index) * 1000),
      kind: 'HARSH_BRAKING',
      severity: 'WARNING',
      details: `Maneuver ${String(index + 1)}`,
    }));
    list.mockResolvedValue({
      items: [
        { ...open, drivingEvents: [] },
        { ...ended, drivingEvents: events },
      ],
      total: 7,
      totalDistanceKm: 812.25,
      dataAsOf: asOf,
    });
    const page = await service.list(context, {
      search: ' cb  иван ',
      filter: {
        startedFrom: '2026-10-11T00:00:00+03:00',
        startedTo: '2026-10-18T00:00:00Z',
        vehicleIds: [vehicleId.toUpperCase()],
        driverIds: [driverId],
        hasDriver: true,
        scored: true,
        drivingScoreBelow: 60,
        hasEnd: false,
      },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 0, limit: 20 },
      {
        tokens: ['cb', 'иван'],
        ids: undefined,
        startedFrom: new Date('2026-10-10T21:00:00.000Z'),
        startedTo: new Date('2026-10-18T00:00:00.000Z'),
        vehicleIds: [vehicleId],
        driverIds: [driverId],
        hasDriver: true,
        scored: true,
        drivingScoreBelow: 60,
        hasEnd: false,
      },
      { field: 'STARTED_AT', direction: 'DESC' },
    );
    expect(drivingEventsByTrip).not.toHaveBeenCalled();
    expect(telemetryAsOf).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      total: 7,
      totalDistanceKm: 812.25,
      items: [
        {
          id: open.id,
          inProgress: true,
          maneuverCount: 0,
          durationSeconds: null,
          drivingEvents: [],
        },
        {
          id: ended.id,
          inProgress: false,
          maneuverCount: 4,
          durationSeconds: 7200,
          drivingEvents: events,
        },
      ],
    });
  });

  it('keeps captured list events and clock when later reads would disagree with hasEvents', async () => {
    const trip = row();
    list.mockResolvedValue({
      items: [{ ...trip, drivingEvents: [] }],
      total: 1,
      totalDistanceKm: 0,
      dataAsOf: asOf,
    });
    telemetryAsOf.mockResolvedValue(new Date(asOf.getTime() + 48 * HOUR));
    const laterEvent: FleetTripDrivingEvent = {
      id: randomUUID(),
      occurredAt: asOf,
      kind: 'HARSH_BRAKING',
      severity: 'INFO',
      details: null,
    };
    drivingEventsByTrip.mockResolvedValue(new Map([[trip.id, [laterEvent]]]));
    const page = await service.list(context, { filter: { allOf: [{ hasEvents: false }] } });
    expect(page.items).toMatchObject([
      { id: trip.id, inProgress: true, maneuverCount: 0, drivingEvents: [] },
    ]);
    expect(page.total).toBe(1);
    expect(telemetryAsOf).not.toHaveBeenCalled();
    expect(drivingEventsByTrip).not.toHaveBeenCalled();
  });

  it('preserves independent conditions and delegates duration sorting before pagination', async () => {
    await service.list(context, {
      offset: 3,
      limit: 2,
      filter: {
        allOf: [
          { vehicleIds: [vehicleId.toUpperCase()] },
          { excludedVehicleIds: [vehicleId], excludedDriverIds: [driverId] },
          { hasDriver: false, hasEvents: false, distanceKmFrom: 0, distanceKmTo: 0 },
          { drivingScoreAbove: 0, drivingScoreBelow: 100 },
        ],
      },
      sort: { field: 'DURATION_SECONDS', direction: 'ASC' },
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 3, limit: 2 },
      expect.objectContaining({
        allOf: [
          expect.objectContaining({ vehicleIds: [vehicleId] }),
          expect.objectContaining({
            excludedVehicleIds: [vehicleId],
            excludedDriverIds: [driverId],
          }),
          expect.objectContaining({
            hasDriver: false,
            hasEvents: false,
            distanceKmFrom: 0,
            distanceKmTo: 0,
          }),
          expect.objectContaining({ drivingScoreAbove: 0, drivingScoreBelow: 100 }),
        ],
      }),
      { field: 'DURATION_SECONDS', direction: 'ASC' },
    );
    expect(telemetryAsOf).not.toHaveBeenCalled();
    expect(drivingEventsByTrip).not.toHaveBeenCalled();
  });

  it('reads whole-Branch summary without fetching a filtered list or per-trip projections', async () => {
    const totals = {
      totalTrips: 5,
      distanceKm: 150.5,
      totalDurationSeconds: 14_400,
      averageDrivingScore: 71.75,
      totalManeuverEvents: 2,
    };
    summary.mockResolvedValue(totals);
    await expect(service.summary(context)).resolves.toEqual(totals);
    expect(summary).toHaveBeenCalledWith(scope);
    expect(list).not.toHaveBeenCalled();
    expect(telemetryAsOf).not.toHaveBeenCalled();
    expect(drivingEventsByTrip).not.toHaveBeenCalled();
  });

  it('rejects invalid filters and sorts on their top-level paths before reading', async () => {
    for (const filter of [
      { drivingScoreBelow: 100.5 },
      { drivingScoreBelow: -1 },
      { startedFrom: '2026-10-18T00:00:00Z', startedTo: '2026-10-18T00:00:00Z' },
      { startedFrom: '2026-10-18' },
      { vehicleIds: [] },
      { driverIds: ['driver'] },
    ]) {
      expect(await fieldErrors(service.list(context, { filter }))).toMatchObject([
        { path: 'filter' },
      ]);
    }
    const sort = { field: 'STARTED_AT' as const, direction: 'ASC' as const };
    Reflect.set(sort, 'field', 'SPEED');
    expect(await fieldErrors(service.list(context, { sort }))).toMatchObject([{ path: 'sort' }]);
    expect(await fieldErrors(service.list(context, { search: 'a b c d e f' }))).toMatchObject([
      { path: 'search' },
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('accepts a one-millisecond started range and finds one trip with the same derived values', async () => {
    await service.list(context, {
      filter: { startedFrom: '2026-10-18T00:00:00.000Z', startedTo: '2026-10-18T00:00:00.001Z' },
      sort: { field: 'DRIVING_SCORE', direction: 'ASC' },
    });
    expect(list).toHaveBeenLastCalledWith(
      scope,
      { offset: 0, limit: 20 },
      expect.objectContaining({ startedTo: new Date('2026-10-18T00:00:00.001Z') }),
      { field: 'DRIVING_SCORE', direction: 'ASC' },
    );
    const trip = row({ startedAt: new Date(asOf.getTime() - 25 * HOUR) });
    find.mockResolvedValue(trip);
    await expect(service.find(context, trip.id)).resolves.toMatchObject({
      id: trip.id,
      inProgress: false,
      maneuverCount: 0,
    });
    telemetryAsOf.mockResolvedValue(null);
    find.mockResolvedValue(row({ id: trip.id }));
    await expect(service.find(context, trip.id)).resolves.toMatchObject({ inProgress: false });
    find.mockResolvedValue(null);
    await expect(service.find(context, trip.id)).rejects.toThrow(NotFoundException);
  });
});
