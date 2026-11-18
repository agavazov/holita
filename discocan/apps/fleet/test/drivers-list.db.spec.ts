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
const now = new Date('2026-10-17T22:30:00.000Z');
const asOf = new Date('2026-10-17T20:00:00.000Z');
const days = (value: number) => new Date(asOf.getTime() + value * 86_400_000);

describe('Driver derived lists with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const branchId = randomUUID();
  const alpha = randomUUID(),
    beta = randomUUID(),
    gamma = randomUUID(),
    delta = randomUUID();

  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({
        requireBranch: jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined),
      })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    const client = database.client;
    await client.driver.createMany({
      data: [
        {
          id: alpha,
          tenantId,
          branchId,
          firstName: 'Alex',
          lastName: 'Zulu',
          employeeNumber: 'E-%_\\',
          licenseCategories: ['B', 'C'],
          licenseExpiresOn: new Date('2026-11-17T00:00:00Z'),
          tachographCardExpiresOn: new Date('2026-10-17T00:00:00Z'),
        },
        {
          id: beta,
          tenantId,
          branchId,
          firstName: 'Blair',
          lastName: 'Bravo',
          status: 'ON_LEAVE',
          licenseCategories: ['B'],
          tachographCardExpiresOn: new Date('2026-11-18T00:00:00Z'),
        },
        {
          id: gamma,
          tenantId,
          branchId,
          firstName: 'Casey',
          lastName: 'Alpha',
          status: 'INACTIVE',
          licenseCategories: ['CE'],
          licenseExpiresOn: new Date('2026-10-17T00:00:00Z'),
        },
        { id: delta, tenantId, branchId, firstName: 'Dana', lastName: 'Delta' },
      ],
    });
    const firstVehicle = (
      await client.vehicle.create({
        data: {
          tenantId,
          branchId,
          licensePlate: 'DRIVER 001',
          currentDriverId: alpha,
        },
      })
    ).id;
    await client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: firstVehicle,
        deviceImei: '990601000000055',
        source: 'DEMO',
        recordedAt: asOf,
        receivedAt: asOf,
      },
    });
    // Manual odometer entries never move the device data clock or the 30-day statistics window.
    await client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: firstVehicle,
        source: 'MANUAL',
        recordedAt: days(10),
        receivedAt: days(10),
        odometerKm: 1000,
      },
    });
    await client.trip.createMany({
      data: [
        { driverId: alpha, startedAt: days(-1), distanceKm: 100, drivingScore: 80 },
        { driverId: alpha, startedAt: days(-10), distanceKm: 50, drivingScore: 50 },
        { driverId: alpha, startedAt: days(-29), distanceKm: 0.4, drivingScore: 10 },
        { driverId: alpha, startedAt: days(-30), distanceKm: 1000, drivingScore: 99 },
        {
          driverId: alpha,
          startedAt: new Date(asOf.getTime() + 1),
          distanceKm: 500,
          drivingScore: 100,
        },
        { driverId: beta, startedAt: asOf, distanceKm: 1, drivingScore: 0 },
        { driverId: gamma, startedAt: days(-2), distanceKm: 0.5, drivingScore: 100 },
        { driverId: delta, startedAt: days(-3), distanceKm: 20, drivingScore: null },
      ].map((trip) => ({
        tenantId,
        branchId,
        vehicleId: firstVehicle,
        source: 'DEMO' as const,
        ...trip,
      })),
    });
    for (const [foreignTenant, foreignBranch] of [
      [tenantId, randomUUID()],
      [randomUUID(), branchId],
    ] as const) {
      const driver = await client.driver.create({
        data: {
          tenantId: foreignTenant,
          branchId: foreignBranch,
          firstName: 'Foreign',
          lastName: 'Zulu',
          licenseExpiresOn: new Date('2026-10-17T00:00:00Z'),
        },
      });
      const vehicle = await client.vehicle.create({
        data: {
          tenantId: foreignTenant,
          branchId: foreignBranch,
          licensePlate: 'DRIVER 001',
          currentDriverId: driver.id,
        },
      });
      await client.trip.create({
        data: {
          tenantId: foreignTenant,
          branchId: foreignBranch,
          vehicleId: vehicle.id,
          driverId: driver.id,
          source: 'DEMO',
          startedAt: days(-1),
          distanceKm: 999,
          drivingScore: 20,
        },
      });
      await client.vehicleStatusSample.create({
        data: {
          tenantId: foreignTenant,
          branchId: foreignBranch,
          vehicleId: vehicle.id,
          deviceImei: '990601000000056',
          source: 'DEMO',
          recordedAt: days(5),
          receivedAt: days(5),
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
    'query($filter:FleetDriverFilter,$sort:FleetDriverSort,$offset:Int!,$limit:Int!,$search:String){fleetDrivers(filter:$filter,sort:$sort,offset:$offset,limit:$limit,search:$search){items{id}total offset limit}}';
  async function ids(variables: Record<string, unknown>) {
    const result = await query(list, { offset: 0, limit: 20, ...variables });
    expect(result).not.toHaveProperty('errors');
    return result;
  }
  const page = (values: string[], total = values.length, offset = 0, limit = 20) => ({
    data: { fleetDrivers: { items: values.map((id) => ({ id })), total, offset, limit } },
  });

  it('30-day driver facts, derived sorts/filters and KPIs', async () => {
    // The scorecard weighted score and 30-day boundaries, not maneuver rate or trip arithmetic.
    expect(
      await query(
        '{fleetDrivers(sort:{field:NAME,direction:ASC}){items{id drivingScore30d distance30dKm tripCount30d maneuversPer100Km30d}}}',
        {},
      ),
    ).toEqual({
      data: {
        fleetDrivers: {
          items: [
            {
              id: alpha,
              drivingScore30d: 70,
              distance30dKm: expect.closeTo(150.4, 10),
              tripCount30d: 3,
              maneuversPer100Km30d: 0,
            },
            {
              id: beta,
              drivingScore30d: 0,
              distance30dKm: 1,
              tripCount30d: 1,
              maneuversPer100Km30d: 0,
            },
            {
              id: gamma,
              drivingScore30d: 100,
              distance30dKm: 0.5,
              tripCount30d: 1,
              maneuversPer100Km30d: 0,
            },
            {
              id: delta,
              drivingScore30d: null,
              distance30dKm: 20,
              tripCount30d: 1,
              maneuversPer100Km30d: 0,
            },
          ],
        },
      },
    });
    expect(
      await query(
        'query($id:ID!){fleetDriverScorecard(driverId:$id,days:30){averageDrivingScore driver{drivingScore30d}}}',
        { id: alpha },
      ),
    ).toEqual({
      data: { fleetDriverScorecard: { averageDrivingScore: 70, driver: { drivingScore30d: 70 } } },
    });
    // Derived sorts and repeated derived conditions apply before paging and counting.
    const pages: [string, Record<string, unknown>, ReturnType<typeof page>][] = [
      [
        'score ascending',
        { sort: { field: 'DRIVING_SCORE_30D', direction: 'ASC' } },
        page([beta, alpha, gamma, delta]),
      ],
      [
        'score descending, second page',
        { sort: { field: 'DRIVING_SCORE_30D', direction: 'DESC' }, offset: 1, limit: 2 },
        page([alpha, beta], 4, 1, 2),
      ],
      [
        'distance ascending',
        { sort: { field: 'DISTANCE_30D_KM', direction: 'ASC' } },
        page([gamma, beta, delta, alpha]),
      ],
      [
        'trip count descending, first row',
        { sort: { field: 'TRIP_COUNT_30D', direction: 'DESC' }, limit: 1 },
        page([alpha], 4, 0, 1),
      ],
      [
        'inclusive score range',
        { filter: { allOf: [{ scoreFrom: 70, scoreTo: 70 }] } },
        page([alpha]),
      ],
      [
        'score below with a score',
        { filter: { allOf: [{ scoreBelow: 70 }, { hasScore: true }] } },
        page([beta]),
      ],
      ['score above', { filter: { allOf: [{ scoreAbove: 70 }] } }, page([gamma])],
      ['without a score', { filter: { allOf: [{ hasScore: false }] } }, page([delta])],
      [
        'exclusive trip count bounds',
        { filter: { allOf: [{ tripCountAbove: 1 }, { tripCountBelow: 4 }] } },
        page([alpha]),
      ],
      [
        'inclusive distance range',
        { filter: { allOf: [{ distanceKmFrom: 0.5, distanceKmTo: 1 }] } },
        page([gamma, beta]),
      ],
      [
        'exclusive distance bounds',
        { filter: { allOf: [{ distanceKmAbove: 0.5 }, { distanceKmBelow: 1 }] } },
        page([]),
      ],
      [
        'strict document date',
        { filter: { allOf: [{ licenseExpiresOnBefore: '2026-11-17' }] } },
        page([gamma]),
      ],
      [
        'inclusive document date range',
        {
          filter: {
            allOf: [{ licenseExpiresOnFrom: '2026-11-17', licenseExpiresOnTo: '2026-11-17' }],
          },
        },
        page([alpha]),
      ],
      ['literal search', { search: '%_\\' }, page([alpha])],
    ];
    for (const [row, variables, expected] of pages) {
      expect({ row, value: await ids(variables) }).toEqual({ row, value: expected });
    }
    // Whole-Branch KPIs are independent of list state and include inactive driver facts once.
    const summary =
      '{fleetDriverSummary{dataAsOf active onLeave documentsExpiring averageDrivingScore distance30dKm}}';
    const expected = {
      data: {
        fleetDriverSummary: {
          dataAsOf: asOf.toISOString(),
          active: 2,
          onLeave: 1,
          documentsExpiring: 2,
          averageDrivingScore: expect.closeTo(170 / 3, 10),
          distance30dKm: expect.closeTo(171.9, 10),
        },
      },
    };
    expect(await query(summary, {})).toEqual(expected);
    expect(await ids({ filter: { allOf: [{ hasScore: false }] }, limit: 1 })).toEqual(
      page([delta], 1, 0, 1),
    );
    expect(await query(summary, {})).toEqual(expected);
    expect(await query(summary, {}, randomUUID())).toEqual({
      data: {
        fleetDriverSummary: {
          dataAsOf: null,
          active: 0,
          onLeave: 0,
          documentsExpiring: 0,
          averageDrivingScore: null,
          distance30dKm: 0,
        },
      },
    });

    // Maneuver rates and the 30-day scorecard window end at the data clock of the scoped Branch.
    const scorecardBranch = randomUUID();
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId: scorecardBranch, licensePlate: 'CB 1040 AX' },
    });
    const driver = await database.client.driver.create({
      data: { tenantId, branchId: scorecardBranch, firstName: 'Мартин', lastName: 'Колев' },
    });
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId: scorecardBranch,
        vehicleId: vehicle.id,
        deviceImei: '990601000000040',
        source: 'DEMO',
        recordedAt: asOf,
        receivedAt: asOf,
      },
    });
    const trip = (
      startedAt: Date,
      values: { distanceKm?: number; drivingScore?: number; ecoScore?: number } = {},
    ) => ({
      tenantId,
      branchId: scorecardBranch,
      vehicleId: vehicle.id,
      driverId: driver.id,
      source: 'DEMO' as const,
      startedAt,
      ...values,
    });
    await database.client.trip.createMany({
      data: [
        trip(days(-1), { distanceKm: 100, drivingScore: 80, ecoScore: 70 }),
        trip(days(-10), { distanceKm: 50, drivingScore: 50 }),
        // Shorter than 0.5 km: counted as a scored trip, never in the averages.
        trip(days(-29), { distanceKm: 0.4, drivingScore: 10, ecoScore: 10 }),
        trip(days(-2)),
        trip(days(-30)),
        trip(days(-31), { distanceKm: 900, drivingScore: 99 }),
      ],
    });
    const maneuver = (
      occurredAt: Date,
      kind: 'HARSH_BRAKING' | 'SPEEDING' | 'IGNITION_ON',
      intensity: number | null,
    ) => ({
      tenantId,
      branchId: scorecardBranch,
      vehicleId: vehicle.id,
      driverId: driver.id,
      source: 'DEMO' as const,
      occurredAt,
      kind,
      severity: 'INFO' as const,
      intensity,
    });
    await database.client.fleetEvent.createMany({
      data: [
        maneuver(days(-1), 'HARSH_BRAKING', 1),
        maneuver(days(-1), 'HARSH_BRAKING', 1),
        maneuver(days(-1), 'HARSH_BRAKING', 3),
        maneuver(days(-10), 'SPEEDING', 2),
        maneuver(days(-1), 'IGNITION_ON', null),
        maneuver(days(-31), 'HARSH_BRAKING', 2),
      ],
    });
    expect(
      await query(
        '{fleetDrivers{items{distance30dKm tripCount30d maneuversPer100Km30d}}}',
        {},
        scorecardBranch,
      ),
    ).toEqual({
      data: {
        fleetDrivers: {
          items: [
            {
              distance30dKm: expect.closeTo(150.4, 10),
              tripCount30d: 4,
              maneuversPer100Km30d: expect.closeTo((4 / 150.4) * 100, 10),
            },
          ],
        },
      },
    });
    expect(
      await query(
        'query($driverId:ID!){fleetDriverScorecard(driverId:$driverId,days:30){asOf windowStart windowEnd distanceKm tripCount scoredTripCount averageDrivingScore averageEcoScore maneuverCount maneuversPer100Km lowConfidence}}',
        { driverId: driver.id },
        scorecardBranch,
      ),
    ).toEqual({
      data: {
        fleetDriverScorecard: {
          asOf: asOf.toISOString(),
          windowStart: days(-30).toISOString(),
          windowEnd: asOf.toISOString(),
          distanceKm: expect.closeTo(150.4, 10),
          tripCount: 4,
          scoredTripCount: 3,
          averageDrivingScore: expect.closeTo((80 * 100 + 50 * 50) / 150, 10),
          averageEcoScore: 70,
          maneuverCount: 4,
          maneuversPer100Km: expect.closeTo((4 / 150.4) * 100, 10),
          lowConfidence: true,
        },
      },
    });
  });
});
