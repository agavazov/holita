import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { DriversRepository } from '../src/modules/drivers/drivers.repository.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-17T22:30:00.000Z');
const asOf = new Date('2026-10-17T20:00:00.000Z');
const days = (value: number) => new Date(asOf.getTime() + value * 86_400_000);

describe('Driver derived lists and bulk actions with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const branchId = randomUUID();
  const alpha = randomUUID(),
    beta = randomUUID(),
    gamma = randomUUID(),
    delta = randomUUID();
  let firstVehicle: string, secondVehicle: string, foreignVehicle: string;

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
    firstVehicle = (
      await client.vehicle.create({
        data: {
          tenantId,
          branchId,
          licensePlate: 'DRIVER 001',
          currentDriverId: alpha,
        },
      })
    ).id;
    secondVehicle = (
      await client.vehicle.create({
        data: {
          tenantId,
          branchId,
          licensePlate: 'DRIVER 002',
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
      foreignVehicle = vehicle.id;
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
      signal: AbortSignal.timeout(5000),
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

  it('uses the scorecard weighted score and 30-day boundaries rather than maneuver rate or trip arithmetic', async () => {
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
  });

  it('sorts score, trips, distance and status before stable paging and count', async () => {
    expect(await ids({ sort: { field: 'DRIVING_SCORE_30D', direction: 'ASC' } })).toEqual(
      page([beta, alpha, gamma, delta]),
    );
    expect(
      await ids({ sort: { field: 'DRIVING_SCORE_30D', direction: 'DESC' }, offset: 1, limit: 2 }),
    ).toEqual(page([alpha, beta], 4, 1, 2));
    expect(await ids({ sort: { field: 'DISTANCE_30D_KM', direction: 'ASC' } })).toEqual(
      page([gamma, beta, delta, alpha]),
    );
    expect(await ids({ sort: { field: 'TRIP_COUNT_30D', direction: 'DESC' }, limit: 1 })).toEqual(
      page([alpha], 4, 0, 1),
    );
    expect(await ids({ sort: { field: 'STATUS', direction: 'ASC' } })).toEqual(
      page([...[alpha, delta].sort().reverse(), beta, gamma]),
    );
  });

  it('ANDs repeated score, trip, status and assigned-vehicle conditions including null and zero', async () => {
    expect(await ids({ filter: { allOf: [{ scoreFrom: 70, scoreTo: 70 }] } })).toEqual(
      page([alpha]),
    );
    expect(await ids({ filter: { allOf: [{ scoreBelow: 70 }, { hasScore: true }] } })).toEqual(
      page([beta]),
    );
    expect(await ids({ filter: { allOf: [{ scoreAbove: 70 }] } })).toEqual(page([gamma]));
    expect(await ids({ filter: { allOf: [{ hasScore: false }] } })).toEqual(page([delta]));
    expect(
      await ids({ filter: { allOf: [{ tripCountAbove: 1 }, { tripCountBelow: 4 }] } }),
    ).toEqual(page([alpha]));
    expect(
      await ids({
        filter: { allOf: [{ statuses: ['ACTIVE'] }, { excludedStatuses: ['ACTIVE'] }] },
      }),
    ).toEqual(page([]));
    expect(
      await ids({ filter: { allOf: [{ hasVehicle: true }, { vehicleIds: [secondVehicle] }] } }),
    ).toEqual(page([alpha]));
    expect(await ids({ filter: { allOf: [{ excludedVehicleIds: [firstVehicle] }] } })).toEqual(
      page([gamma, beta, delta]),
    );
    expect(
      await ids({ filter: { allOf: [{ vehicleIds: [secondVehicle] }, { hasVehicle: false }] } }),
    ).toEqual(page([]));
    expect(await ids({ filter: { allOf: [{ vehicleIds: [foreignVehicle] }] } })).toEqual(page([]));
    expect(await ids({ filter: { allOf: [{ distanceKmFrom: 0.5, distanceKmTo: 1 }] } })).toEqual(
      page([gamma, beta]),
    );
    expect(
      await ids({ filter: { allOf: [{ distanceKmAbove: 0.5 }, { distanceKmBelow: 1 }] } }),
    ).toEqual(page([]));
    expect(
      await ids({ filter: { licenseCategories: ['C'], allOf: [{ licenseCategories: ['B'] }] } }),
    ).toEqual(page([alpha]));
  });

  it('uses strict document comparisons, inclusive ranges and literal search patterns', async () => {
    expect(await ids({ filter: { allOf: [{ licenseExpiresOnBefore: '2026-11-17' }] } })).toEqual(
      page([gamma]),
    );
    expect(
      await ids({
        filter: {
          allOf: [{ licenseExpiresOnFrom: '2026-11-17', licenseExpiresOnTo: '2026-11-17' }],
        },
      }),
    ).toEqual(page([alpha]));
    expect(
      await ids({ filter: { allOf: [{ tachographCardExpiresOnAfter: '2026-10-17' }] } }),
    ).toEqual(page([beta]));
    expect(
      await ids({
        filter: {
          allOf: [
            { tachographCardExpiresOnFrom: '2026-10-17', tachographCardExpiresOnTo: '2026-10-17' },
          ],
        },
      }),
    ).toEqual(page([alpha]));
    expect(await ids({ search: '%_\\' })).toEqual(page([alpha]));
  });

  it('keeps whole-Branch KPIs independent of list state and includes inactive driver facts once', async () => {
    const source =
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
    expect(await query(source, {})).toEqual(expected);
    expect(await ids({ filter: { allOf: [{ hasScore: false }] }, limit: 1 })).toEqual(
      page([delta], 1, 0, 1),
    );
    expect(await query(source, {})).toEqual(expected);
    expect(await query(source, {}, randomUUID())).toEqual({
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
  });

  it('keeps filtered and sorted Driver facts when a new trip and data clock arrive after page selection', async () => {
    if (!app) {
      throw new Error('Missing Fleet application.');
    }
    const scope = randomUUID();
    const [firstDriver, secondDriver] = await Promise.all(
      ['First', 'Second'].map((firstName) =>
        database.client.driver.create({
          data: { tenantId, branchId: scope, firstName, lastName: 'Snapshot' },
        }),
      ),
    );
    if (!firstDriver || !secondDriver) {
      throw new Error('Missing Driver snapshot fixtures.');
    }
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId: scope, licensePlate: 'SNAPSHOT DRIVER' },
    });
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId: scope,
        vehicleId: vehicle.id,
        deviceImei: '000000000000041',
        source: 'DEMO',
        recordedAt: asOf,
        receivedAt: asOf,
      },
    });
    await database.client.trip.createMany({
      data: [
        { driverId: firstDriver.id, startedAt: days(-29), drivingScore: 90 },
        { driverId: secondDriver.id, startedAt: days(-1), drivingScore: 80 },
      ].map((trip) => ({
        tenantId,
        branchId: scope,
        vehicleId: vehicle.id,
        source: 'DEMO' as const,
        distanceKm: 100,
        ...trip,
      })),
    });
    const repository = app.get(DriversRepository);
    const originalList = repository.list.bind(repository);
    const selected = jest
      .spyOn(repository, 'list')
      .mockImplementationOnce(async (capturedScope, page, criteria, sort) => {
        const result = await originalList(capturedScope, page, criteria, sort);
        await database.client.$transaction([
          database.client.trip.create({
            data: {
              tenantId,
              branchId: scope,
              vehicleId: vehicle.id,
              driverId: firstDriver.id,
              source: 'DEMO',
              startedAt: days(1),
              distanceKm: 900,
              drivingScore: 0,
            },
          }),
          database.client.vehicleStatusSample.create({
            data: {
              tenantId,
              branchId: scope,
              vehicleId: vehicle.id,
              deviceImei: '000000000000041',
              source: 'DEMO',
              recordedAt: days(2),
              receivedAt: days(2),
            },
          }),
        ]);
        return result;
      });
    const source =
      '{fleetDrivers(filter:{allOf:[{scoreAbove:75}]},sort:{field:DRIVING_SCORE_30D,direction:DESC},limit:1){items{id drivingScore30d distance30dKm tripCount30d}total offset limit}}';
    try {
      expect(await query(source, {}, scope)).toEqual({
        data: {
          fleetDrivers: {
            items: [
              { id: firstDriver.id, drivingScore30d: 90, distance30dKm: 100, tripCount30d: 1 },
            ],
            total: 2,
            offset: 0,
            limit: 1,
          },
        },
      });
      expect(await query(source, {}, scope)).toEqual({
        data: {
          fleetDrivers: {
            items: [
              { id: secondDriver.id, drivingScore30d: 80, distance30dKm: 100, tripCount30d: 1 },
            ],
            total: 1,
            offset: 0,
            limit: 1,
          },
        },
      });
    } finally {
      selected.mockRestore();
    }
  });

  it('deactivates and deletes independently, retaining assigned/history and foreign-scope failures', async () => {
    const scope = randomUUID();
    const client = database.client;
    const [available, assigned, history] = await Promise.all(
      ['Available', 'Assigned', 'History'].map((firstName) =>
        client.driver.create({ data: { tenantId, branchId: scope, firstName, lastName: 'Batch' } }),
      ),
    );
    if (!available || !assigned || !history) {
      throw new Error('Missing batch fixtures.');
    }
    const vehicle = await client.vehicle.create({
      data: {
        tenantId,
        branchId: scope,
        licensePlate: 'BATCH 001',
        currentDriverId: assigned.id,
      },
    });
    await client.trip.create({
      data: {
        tenantId,
        branchId: scope,
        vehicleId: vehicle.id,
        driverId: history.id,
        source: 'DEMO',
        startedAt: days(-1),
      },
    });
    const foreign = await client.driver.create({
      data: {
        tenantId,
        branchId: randomUUID(),
        firstName: 'Foreign',
        lastName: 'Batch',
      },
    });
    const selected = [assigned.id, available.id, history.id, foreign.id];
    expect(
      await query(
        'mutation($ids:[ID!]!){deactivateFleetDrivers(ids:$ids){succeededIds failures{id code message}}}',
        { ids: selected },
        scope,
      ),
    ).toEqual({
      data: {
        deactivateFleetDrivers: {
          succeededIds: [available.id, history.id],
          failures: [
            {
              id: assigned.id,
              code: 'BAD_USER_INPUT',
              message: 'Unassign the driver from its vehicles first.',
            },
            { id: foreign.id, code: 'NOT_FOUND', message: 'Driver not found' },
          ],
        },
      },
    });
    expect(
      await query(
        'mutation($ids:[ID!]!){deleteFleetDrivers(ids:$ids){succeededIds failures{id code message}}}',
        { ids: selected },
        scope,
      ),
    ).toEqual({
      data: {
        deleteFleetDrivers: {
          succeededIds: [available.id],
          failures: [
            {
              id: assigned.id,
              code: 'CONFLICT',
              message: 'Driver is assigned or has trip history; set the driver inactive instead.',
            },
            {
              id: history.id,
              code: 'CONFLICT',
              message: 'Driver is assigned or has trip history; set the driver inactive instead.',
            },
            { id: foreign.id, code: 'NOT_FOUND', message: 'Driver not found' },
          ],
        },
      },
    });
    expect(
      await client.driver.findUniqueOrThrow({
        where: { id: assigned.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'ACTIVE' });
    expect(
      await client.driver.findUniqueOrThrow({
        where: { id: history.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'INACTIVE' });
    expect(
      await client.driver.findUniqueOrThrow({
        where: { id: foreign.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'ACTIVE' });
    expect(await client.driver.findUnique({ where: { id: available.id } })).toBeNull();
  });
});
