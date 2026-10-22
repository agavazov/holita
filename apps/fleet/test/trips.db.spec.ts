import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const asOf = new Date('2026-10-18T06:30:00.000Z');
const hours = (value: number) => new Date(asOf.getTime() + value * 3_600_000);

describe('Trips list contract with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const branchId = randomUUID();
  const firstManeuver = randomUUID();
  const secondManeuver = randomUUID();
  const trips: Record<'t1' | 't2' | 't3' | 't4' | 't5', string> = {
    t1: '',
    t2: '',
    t3: '',
    t4: '',
    t5: '',
  };
  let firstVehicle: string, georgi: string, anna: string;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch: jest.fn<CoreClient['requireBranch']>() })
      .overrideProvider(FleetClock)
      .useValue({ now: () => hours(0.5) })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    const client = database.client;
    firstVehicle = (
      await client.vehicle.create({
        data: { tenantId, branchId, licensePlate: 'CB 1001 AX', fleetNumber: 'Т-01' },
      })
    ).id;
    const secondVehicle = (
      await client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'CB 1002 AX' } })
    ).id;
    georgi = (
      await client.driver.create({
        data: { tenantId, branchId, firstName: 'Георги', lastName: 'Иванов' },
      })
    ).id;
    anna = (
      await client.driver.create({
        data: { tenantId, branchId, firstName: 'Anna', lastName: 'Petrova' },
      })
    ).id;
    await client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: firstVehicle,
        deviceImei: '990601000000001',
        source: 'DEMO',
        recordedAt: asOf,
        receivedAt: asOf,
      },
    });
    const create = async (data: {
      vehicleId: string;
      driverId?: string;
      startedAt: Date;
      endedAt?: Date;
      distanceKm?: number;
      drivingScore?: number;
      startAddress?: string;
      endAddress?: string;
    }) => (await client.trip.create({ data: { tenantId, branchId, source: 'DEMO', ...data } })).id;
    trips.t1 = await create({
      vehicleId: firstVehicle,
      driverId: georgi,
      startedAt: hours(-72),
      endedAt: hours(-70),
      distanceKm: 120.5,
      drivingScore: 88,
      startAddress: 'София',
      endAddress: 'Пловдив %_\\',
    });
    trips.t2 = await create({
      vehicleId: firstVehicle,
      startedAt: hours(-48),
      endedAt: hours(-47),
    });
    trips.t3 = await create({
      vehicleId: secondVehicle,
      driverId: anna,
      startedAt: hours(-24),
      endedAt: hours(-23),
      distanceKm: 30,
      drivingScore: 55.5,
    });
    trips.t4 = await create({ vehicleId: secondVehicle, driverId: georgi, startedAt: hours(-2) });
    trips.t5 = await create({ vehicleId: firstVehicle, driverId: anna, startedAt: hours(-30) });
    await client.fleetEvent.createMany({
      data: [
        {
          id: firstManeuver,
          kind: 'HARSH_BRAKING' as const,
          intensity: 2,
          details: 'Brake applied',
        },
        { id: secondManeuver, kind: 'SHARP_TURN' as const, intensity: null, details: null },
        { id: randomUUID(), kind: 'IGNITION_ON' as const, intensity: null, details: null },
      ].map((event, index) => ({
        tenantId,
        branchId,
        vehicleId: firstVehicle,
        tripId: trips.t1,
        driverId: georgi,
        source: 'DEMO' as const,
        occurredAt: hours(-71 + index / 10),
        severity: 'INFO' as const,
        ...event,
      })),
    });
    await client.fleetEvent.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId: firstVehicle,
          tripId: trips.t2,
          source: 'DEMO',
          occurredAt: hours(-47.5),
          severity: 'INFO',
          kind: 'IGNITION_ON',
        },
        {
          tenantId,
          branchId,
          vehicleId: firstVehicle,
          source: 'DEMO',
          occurredAt: hours(-1),
          severity: 'WARNING',
          kind: 'HARSH_BRAKING',
        },
      ],
    });
    // Same plates and drivers in another Branch and another Tenant stay invisible.
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, randomUUID()],
      [randomUUID(), branchId],
    ] as const) {
      const vehicle = await client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'CB 1001 AX' },
      });
      const foreignTrip = await client.trip.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: vehicle.id,
          source: 'DEMO',
          startedAt: hours(-1),
          distanceKm: 999,
          drivingScore: 10,
        },
      });
      await client.fleetEvent.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: vehicle.id,
          tripId: foreignTrip.id,
          source: 'DEMO',
          occurredAt: hours(-0.5),
          severity: 'WARNING',
          kind: 'HARSH_BRAKING',
        },
      });
    }
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(source: string, variables: Record<string, unknown>, scope = branchId) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        'x-branch-id': scope,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  const list =
    'query($search:String,$filter:FleetTripFilter,$sort:FleetTripSort,$offset:Int!,$limit:Int!){fleetTrips(search:$search,filter:$filter,sort:$sort,offset:$offset,limit:$limit){items{id}total offset limit totalDistanceKm}}';
  async function ids(variables: Record<string, unknown>) {
    const body = await query(list, { offset: 0, limit: 20, ...variables });
    expect(body).not.toHaveProperty('errors');
    return body;
  }
  function page(
    keys: (keyof typeof trips)[],
    totalDistanceKm: number,
    total = keys.length,
    offset = 0,
    limit = 20,
  ) {
    return {
      data: {
        fleetTrips: {
          items: keys.map((key) => ({ id: trips[key] })),
          total,
          offset,
          limit,
          totalDistanceKm,
        },
      },
    };
  }

  it('trips list derived values and totals', async () => {
    const byDistance = { field: 'DISTANCE_KM', direction: 'ASC' };
    const pages: [string, Record<string, unknown>, ReturnType<typeof page>][] = [
      [
        'whole-second duration ascending',
        { sort: { field: 'DURATION_SECONDS', direction: 'ASC' } },
        page(['t3', 't2', 't1', 't4', 't5'], 150.5),
      ],
      [
        'whole-second duration descending',
        { sort: { field: 'DURATION_SECONDS', direction: 'DESC' } },
        page(['t1', 't3', 't2', 't4', 't5'], 150.5),
      ],
      [
        'duration page',
        { sort: { field: 'DURATION_SECONDS', direction: 'ASC' }, offset: 1, limit: 2 },
        page(['t2', 't1'], 150.5, 5, 1, 2),
      ],
      ['default order', {}, page(['t4', 't3', 't5', 't2', 't1'], 150.5)],
      [
        'distance ascending, nulls last',
        { sort: byDistance },
        page(['t3', 't1', 't4', 't5', 't2'], 150.5),
      ],
      [
        'distance descending, nulls last',
        { sort: { field: 'DISTANCE_KM', direction: 'DESC' } },
        page(['t1', 't3', 't4', 't5', 't2'], 150.5),
      ],
      ['first distance page', { sort: byDistance, limit: 2 }, page(['t3', 't1'], 150.5, 5, 0, 2)],
      [
        'second distance page',
        { sort: byDistance, offset: 2, limit: 2 },
        page(['t4', 't5'], 150.5, 5, 2, 2),
      ],
      [
        'last distance page',
        { sort: byDistance, offset: 4, limit: 2 },
        page(['t2'], 150.5, 5, 4, 2),
      ],
      ['without an end', { filter: { hasEnd: false } }, page(['t4', 't5'], 0)],
      ['without a score', { filter: { scored: false } }, page(['t4', 't5', 't2'], 0)],
      [
        'half-open period',
        { filter: { startedFrom: hours(-48).toISOString(), startedTo: hours(-24).toISOString() } },
        page(['t5', 't2'], 0),
      ],
      ['search across vehicle and driver', { search: 'т-01 георги' }, page(['t1'], 120.5)],
      ['literal search', { search: '%_\\' }, page(['t1'], 120.5)],
      ['with events', { filter: { allOf: [{ hasEvents: true }] } }, page(['t1'], 120.5)],
      [
        'without events',
        { filter: { allOf: [{ hasEvents: false }] } },
        page(['t4', 't3', 't5', 't2'], 30),
      ],
      [
        'contradicting event conditions',
        { filter: { allOf: [{ hasEvents: true }, { hasEvents: false }] } },
        page([], 0),
      ],
      [
        'driver exclusion keeps trips without a driver',
        { filter: { allOf: [{ excludedDriverIds: [georgi] }] } },
        page(['t3', 't5', 't2'], 30),
      ],
      [
        'inclusive distance range',
        { filter: { allOf: [{ distanceKmFrom: 30, distanceKmTo: 120.5 }] } },
        page(['t3', 't1'], 150.5),
      ],
      [
        'exclusive distance bounds',
        { filter: { allOf: [{ distanceKmAbove: 30 }, { distanceKmBelow: 120.5 }] } },
        page([], 0),
      ],
      [
        'score bounds before paging',
        { filter: { allOf: [{ drivingScoreAbove: 55.4 }, { drivingScoreBelow: 88.1 }] }, limit: 1 },
        page(['t3'], 150.5, 2, 0, 1),
      ],
      [
        'repeated periods',
        {
          filter: {
            allOf: [
              { startedFrom: hours(-48).toISOString(), startedTo: hours(-23).toISOString() },
              { startedFrom: hours(-30).toISOString(), startedTo: hours(-24).toISOString() },
            ],
          },
        },
        page(['t5'], 0),
      ],
      [
        'top-level and repeated conditions',
        {
          filter: {
            vehicleIds: [firstVehicle],
            allOf: [{ distanceKmFrom: 30, distanceKmTo: 120.5 }],
          },
        },
        page(['t1'], 120.5),
      ],
    ];
    for (const [row, variables, expected] of pages) {
      expect({ row, value: await ids(variables) }).toEqual({ row, value: expected });
    }
    // Whole-Branch totals are independent of list filters and exclude standalone maneuvers.
    const summary =
      '{fleetTripSummary{totalTrips distanceKm totalDurationSeconds averageDrivingScore totalManeuverEvents}}';
    const totals = {
      data: {
        fleetTripSummary: {
          totalTrips: 5,
          distanceKm: 150.5,
          totalDurationSeconds: 14_400,
          averageDrivingScore: 71.75,
          totalManeuverEvents: 2,
        },
      },
    };
    expect(await query(summary, {})).toEqual(totals);
    expect(await ids({ filter: { allOf: [{ hasEvents: false }] }, offset: 2, limit: 1 })).toEqual(
      page(['t5'], 30, 4, 2, 1),
    );
    expect(await query(summary, {})).toEqual(totals);
    expect(await query(summary, {}, randomUUID())).toEqual({
      data: {
        fleetTripSummary: {
          totalTrips: 0,
          distanceKm: 0,
          totalDurationSeconds: 0,
          averageDrivingScore: null,
          totalManeuverEvents: 0,
        },
      },
    });
    // One trip with maneuvers, duration and in-progress state in scope.
    const trip =
      'query($id:ID!){fleetTrip(id:$id){id vehicle{licensePlate fleetNumber} driver{firstName lastName} durationSeconds maneuverCount drivingEvents{id occurredAt kind severity details} inProgress endedAt}}';
    expect(await query(trip, { id: trips.t1 })).toEqual({
      data: {
        fleetTrip: {
          id: trips.t1,
          vehicle: { licensePlate: 'CB 1001 AX', fleetNumber: 'Т-01' },
          driver: { firstName: 'Георги', lastName: 'Иванов' },
          durationSeconds: 7200,
          maneuverCount: 2,
          drivingEvents: [
            {
              id: firstManeuver,
              occurredAt: hours(-71).toISOString(),
              kind: 'HARSH_BRAKING',
              severity: 'INFO',
              details: 'Brake applied',
            },
            {
              id: secondManeuver,
              occurredAt: hours(-70.9).toISOString(),
              kind: 'SHARP_TURN',
              severity: 'INFO',
              details: null,
            },
          ],
          inProgress: false,
          endedAt: hours(-70).toISOString(),
        },
      },
    });
    expect(await query(trip, { id: trips.t4 })).toMatchObject({
      data: { fleetTrip: { inProgress: true, maneuverCount: 0, durationSeconds: null } },
    });
    expect(await query(trip, { id: trips.t5 })).toMatchObject({
      data: { fleetTrip: { inProgress: false } },
    });
    expect(await query(trip, { id: trips.t1 }, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(
      await query('query($ids:[ID!]){fleetTrips(ids:$ids){items{id maneuverCount}total}}', {
        ids: [trips.t1, trips.t2],
      }),
    ).toEqual({
      data: {
        fleetTrips: {
          items: [
            { id: trips.t2, maneuverCount: 0 },
            { id: trips.t1, maneuverCount: 2 },
          ],
          total: 2,
        },
      },
    });
  });
});
