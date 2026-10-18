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
  const trips: Record<'t1' | 't2' | 't3' | 't4' | 't5', string> = {
    t1: '',
    t2: '',
    t3: '',
    t4: '',
    t5: '',
  };
  let firstVehicle: string, secondVehicle: string, georgi: string, anna: string;
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
    secondVehicle = (
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
      endAddress: 'Пловдив',
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
        { kind: 'HARSH_BRAKING' as const, intensity: 2 },
        { kind: 'SHARP_TURN' as const, intensity: null },
        { kind: 'IGNITION_ON' as const, intensity: null },
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
    // Same plates and drivers in another Branch and another Tenant stay invisible.
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, randomUUID()],
      [randomUUID(), branchId],
    ] as const) {
      const vehicle = await client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'CB 1001 AX' },
      });
      await client.trip.create({
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

  it('sorts with nulls last and the startedAt tie-break, pages consistently and sums the filtered distance', async () => {
    expect(await ids({})).toEqual(page(['t4', 't3', 't5', 't2', 't1'], 150.5));
    expect(await ids({ sort: { field: 'DISTANCE_KM', direction: 'ASC' } })).toEqual(
      page(['t3', 't1', 't4', 't5', 't2'], 150.5),
    );
    expect(await ids({ sort: { field: 'DISTANCE_KM', direction: 'DESC' } })).toEqual(
      page(['t1', 't3', 't4', 't5', 't2'], 150.5),
    );
    expect(await ids({ sort: { field: 'DRIVING_SCORE', direction: 'DESC' } })).toEqual(
      page(['t1', 't3', 't4', 't5', 't2'], 150.5),
    );
    expect(await ids({ sort: { field: 'STARTED_AT', direction: 'ASC' } })).toEqual(
      page(['t1', 't2', 't5', 't3', 't4'], 150.5),
    );
    for (const [offset, keys] of [
      [0, ['t3', 't1']],
      [2, ['t4', 't5']],
      [4, ['t2']],
    ] as const)
      expect(
        await ids({ sort: { field: 'DISTANCE_KM', direction: 'ASC' }, offset, limit: 2 }),
      ).toEqual(page([...keys], 150.5, 5, offset, 2));
  });

  it('filters by period, vehicles, drivers, score and end, and searches stored relations', async () => {
    expect(await ids({ filter: { hasDriver: false } })).toEqual(page(['t2'], 0));
    expect(await ids({ filter: { scored: true } })).toEqual(page(['t3', 't1'], 150.5));
    expect(await ids({ filter: { scored: false } })).toEqual(page(['t4', 't5', 't2'], 0));
    expect(await ids({ filter: { drivingScoreBelow: 60 } })).toEqual(page(['t3'], 30));
    expect(await ids({ filter: { hasEnd: false } })).toEqual(page(['t4', 't5'], 0));
    expect(await ids({ filter: { vehicleIds: [secondVehicle] } })).toEqual(page(['t4', 't3'], 30));
    expect(await ids({ filter: { driverIds: [georgi] } })).toEqual(page(['t4', 't1'], 120.5));
    expect(
      await ids({
        filter: { startedFrom: hours(-48).toISOString(), startedTo: hours(-24).toISOString() },
      }),
    ).toEqual(page(['t5', 't2'], 0));
    expect(await ids({ search: 'иванов' })).toEqual(page(['t4', 't1'], 120.5));
    expect(await ids({ search: 'ПЛОВДИВ' })).toEqual(page(['t1'], 120.5));
    expect(await ids({ search: 'cb 1002' })).toEqual(page(['t4', 't3'], 30));
    expect(await ids({ search: 'т-01 георги' })).toEqual(page(['t1'], 120.5));
    expect(
      await query(list, { offset: 0, limit: 20, filter: { drivingScoreBelow: 101 } }),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'filter' }] } }] });
  });

  it('reads one trip with maneuvers, duration and in-progress state in scope', async () => {
    const trip =
      'query($id:ID!){fleetTrip(id:$id){id vehicle{licensePlate fleetNumber} driver{firstName lastName} durationSeconds maneuverCount inProgress endedAt}}';
    expect(await query(trip, { id: trips.t1 })).toEqual({
      data: {
        fleetTrip: {
          id: trips.t1,
          vehicle: { licensePlate: 'CB 1001 AX', fleetNumber: 'Т-01' },
          driver: { firstName: 'Георги', lastName: 'Иванов' },
          durationSeconds: 7200,
          maneuverCount: 2,
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
