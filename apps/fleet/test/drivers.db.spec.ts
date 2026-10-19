import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
// 22:30 UTC on 17 October is the business date 18 October 2026 in Europe/Sofia.
const now = new Date('2026-10-17T22:30:00.000Z');
const fields =
  'id branchId firstName lastName employeeNumber identificationKey phone email licenseNumber licenseCategories licenseExpiresOn tachographCardNumber tachographCardExpiresOn status notes documentStatus vehicles{__typename id licensePlate fleetNumber vehicleType status}';
const create = `mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){${fields}}}`;
const read = `query($id:ID!){fleetDriver(id:$id){${fields}}}`;
const update = `mutation($id:ID!,$input:UpdateFleetDriverInput!){updateFleetDriver(id:$id,input:$input){${fields}}}`;
const remove = 'mutation($id:ID!){deleteFleetDriver(id:$id){id}}';

describe('Driver GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  beforeEach(() => {
    requireBranch.mockClear();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown>,
    branchId: string,
    scopeTenantId = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        'x-branch-id': branchId,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('creates, reads, updates and deletes drivers with the Core check only on creation', async () => {
    const branchId = randomUUID();
    const created = await query(
      create,
      {
        input: {
          firstName: ' Георги ',
          lastName: ' Иванов ',
          employeeNumber: 'E-001',
          identificationKey: '01A2B3C4',
          phone: '+359 888 123 456',
          email: 'g.ivanov@example.test',
          licenseNumber: '285001234',
          licenseCategories: ['CE', 'B', 'C'],
          licenseExpiresOn: '2026-11-17',
          tachographCardNumber: 'BG12345678',
          tachographCardExpiresOn: '2028-02-29',
          notes: ' Night shifts ',
        },
      },
      branchId,
    );
    expect(created).toMatchObject({
      data: {
        createFleetDriver: {
          branchId,
          firstName: 'Георги',
          lastName: 'Иванов',
          licenseCategories: ['B', 'C', 'CE'],
          licenseExpiresOn: '2026-11-17',
          tachographCardExpiresOn: '2028-02-29',
          status: 'ACTIVE',
          notes: 'Night shifts',
          documentStatus: 'EXPIRING',
          vehicles: [],
        },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    const row = await database.client.driver.findFirstOrThrow({ where: { branchId } });
    expect(row.licenseExpiresOn).toEqual(new Date('2026-11-17T00:00:00.000Z'));
    requireBranch.mockClear();
    expect(
      await query(
        update,
        { id: row.id, input: { licenseExpiresOn: '2026-11-18', status: 'ON_LEAVE', phone: null } },
        branchId,
      ),
    ).toMatchObject({
      data: {
        updateFleetDriver: {
          licenseExpiresOn: '2026-11-18',
          status: 'ON_LEAVE',
          phone: null,
          documentStatus: 'VALID',
        },
      },
    });
    expect(
      await query(update, { id: row.id, input: { licenseExpiresOn: '2026-10-17' } }, branchId),
    ).toMatchObject({ data: { updateFleetDriver: { documentStatus: 'EXPIRED' } } });
    expect(
      await query(update, { id: row.id, input: { licenseExpiresOn: '2026-02-30' } }, branchId),
    ).toMatchObject({
      errors: [
        { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'licenseExpiresOn' }] } },
      ],
    });
    for (const source of [read, update, remove]) {
      expect(
        await query(source, { id: row.id, input: { notes: 'x' } }, randomUUID()),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
    expect(await query(read, { id: row.id }, branchId, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(remove, { id: row.id }, branchId)).toEqual({
      data: { deleteFleetDriver: { id: row.id } },
    });
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('keeps employee numbers and identification keys unique per Branch', async () => {
    const branchId = randomUUID();
    await database.client.driver.create({
      data: {
        tenantId,
        branchId,
        firstName: 'A',
        lastName: 'One',
        employeeNumber: 'E-1',
        identificationKey: 'K-1',
      },
    });
    const other = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'B', lastName: 'Two' },
    });
    expect(
      await query(
        create,
        {
          input: {
            firstName: 'C',
            lastName: 'Three',
            employeeNumber: 'E-1',
            identificationKey: 'K-1',
          },
        },
        branchId,
      ),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'employeeNumber' }, { path: 'identificationKey' }],
          },
        },
      ],
    });
    expect(
      await query(update, { id: other.id, input: { identificationKey: 'K-1' } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'identificationKey' }] } }] });
    expect(
      await query(
        create,
        { input: { firstName: 'C', lastName: 'Three', employeeNumber: 'E-1' } },
        randomUUID(),
      ),
    ).toMatchObject({ data: { createFleetDriver: { employeeNumber: 'E-1' } } });
  });

  it('protects assigned drivers from deletion and deactivation and lists their vehicles by plate', async () => {
    const branchId = randomUUID();
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'A', lastName: 'Assigned' },
    });
    for (const licensePlate of ['PB 2002 KM', 'CB 1001 AX']) {
      await database.client.vehicle.create({
        data: { tenantId, branchId, licensePlate, currentDriverId: driver.id },
      });
    }
    expect(await query(read, { id: driver.id }, branchId)).toMatchObject({
      data: {
        fleetDriver: {
          vehicles: [
            { __typename: 'FleetVehicleRef', licensePlate: 'CB 1001 AX', status: 'ACTIVE' },
            { licensePlate: 'PB 2002 KM' },
          ],
        },
      },
    });
    expect(
      await query(update, { id: driver.id, input: { status: 'INACTIVE' } }, branchId),
    ).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'status' }] } }],
    });
    expect(await query(remove, { id: driver.id }, branchId)).toMatchObject({
      errors: [
        {
          message: 'Driver is assigned or has trip history; set the driver inactive instead.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
    await database.client.vehicle.updateMany({
      where: { branchId },
      data: { currentDriverId: null },
    });
    expect(
      await query(update, { id: driver.id, input: { status: 'INACTIVE' } }, branchId),
    ).toMatchObject({ data: { updateFleetDriver: { status: 'INACTIVE', vehicles: [] } } });
    expect(await query(remove, { id: driver.id }, branchId)).toEqual({
      data: { deleteFleetDriver: { id: driver.id } },
    });
  });

  it('filters documents at the fixed business date, searches names and sorts in scope', async () => {
    const branchId = randomUUID();
    const rows = [
      {
        firstName: 'Георги',
        lastName: 'Иванов',
        employeeNumber: 'E-3',
        licenseExpiresOn: new Date('2026-10-17T00:00:00Z'),
        licenseCategories: ['C', 'CE'],
      },
      {
        firstName: 'Anna',
        lastName: 'Ivanova',
        employeeNumber: 'E-1',
        tachographCardExpiresOn: new Date('2026-11-17T00:00:00Z'),
        licenseCategories: ['B'],
        status: 'ON_LEAVE',
      },
      {
        firstName: 'Boris',
        lastName: 'Ivanov',
        licenseExpiresOn: new Date('2026-11-18T00:00:00Z'),
        phone: '+359 888 000 111',
      },
      { firstName: 'Anton', lastName: 'Ivanov', employeeNumber: 'E-2', status: 'INACTIVE' },
    ] as const;
    for (const row of rows) {
      await database.client.driver.create({
        data: {
          tenantId,
          branchId,
          ...row,
          licenseCategories: 'licenseCategories' in row ? [...row.licenseCategories] : [],
        },
      });
    }
    await database.client.driver.create({
      data: { tenantId, branchId: randomUUID(), firstName: 'Other', lastName: 'Ivanov' },
    });
    await database.client.driver.create({
      data: { tenantId: randomUUID(), branchId, firstName: 'Tenant', lastName: 'Ivanov' },
    });
    const assigned = await database.client.driver.findFirstOrThrow({
      where: { branchId, firstName: 'Boris' },
    });
    await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'CB 1001 AX', currentDriverId: assigned.id },
    });
    const source =
      'query($search:String,$filter:FleetDriverFilter,$sort:FleetDriverSort){fleetDrivers(search:$search,filter:$filter,sort:$sort){items{firstName lastName documentStatus}total}}';
    async function names(variables: Record<string, unknown>) {
      const body = await query(source, variables, branchId);
      expect(body).not.toHaveProperty('errors');
      return body;
    }
    function page(values: string[]) {
      return {
        data: {
          fleetDrivers: {
            items: values.map((value) => expect.objectContaining({ firstName: value })),
            total: values.length,
          },
        },
      };
    }
    expect(await names({})).toMatchObject(page(['Anton', 'Boris', 'Anna', 'Георги']));
    expect(await names({ sort: { field: 'LAST_NAME', direction: 'DESC' } })).toMatchObject(
      page(['Георги', 'Anna', 'Boris', 'Anton']),
    );
    expect(await names({ sort: { field: 'EMPLOYEE_NUMBER', direction: 'DESC' } })).toMatchObject(
      page(['Георги', 'Anton', 'Anna', 'Boris']),
    );
    expect(await names({ sort: { field: 'LICENSE_EXPIRES_ON', direction: 'ASC' } })).toMatchObject({
      data: { fleetDrivers: { total: 4 } },
    });
    expect(await names({ filter: { documentsExpireWithinDays: 30 } })).toMatchObject(
      page(['Anna', 'Георги']),
    );
    expect(await names({ filter: { documentsExpireWithinDays: 31 } })).toMatchObject(
      page(['Boris', 'Anna', 'Георги']),
    );
    expect(await names({ filter: { documentsExpireWithinDays: 0 } })).toMatchObject(
      page(['Георги']),
    );
    expect(await names({ search: 'георги ИВАНОВ' })).toEqual({
      data: {
        fleetDrivers: {
          items: [{ firstName: 'Георги', lastName: 'Иванов', documentStatus: 'EXPIRED' }],
          total: 1,
        },
      },
    });
    expect(await names({ search: 'iva E-1' })).toMatchObject(page(['Anna']));
    expect(await names({ search: '888 000' })).toMatchObject(page(['Boris']));
    expect(await names({ filter: { statuses: ['ON_LEAVE', 'INACTIVE'] } })).toMatchObject(
      page(['Anton', 'Anna']),
    );
    expect(await names({ filter: { licenseCategories: ['CE', 'B'] } })).toMatchObject(
      page(['Anna', 'Георги']),
    );
    expect(await names({ filter: { hasVehicle: true } })).toMatchObject(page(['Boris']));
    expect(await names({ filter: { hasVehicle: false } })).toMatchObject(
      page(['Anton', 'Anna', 'Георги']),
    );
    expect(
      await query(source, { filter: { documentsExpireWithinDays: 366 } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'filter' }] } }] });
  });

  it('computes 30-day statistics and scorecards before the data clock', async () => {
    const branchId = randomUUID();
    const asOf = new Date('2026-10-17T20:00:00.000Z');
    const days = (value: number) => new Date(asOf.getTime() + value * 86_400_000);
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'CB 1040 AX' },
    });
    const [driver, idle] = await Promise.all(
      ['Мартин', 'Иван'].map((firstName) =>
        database.client.driver.create({
          data: { tenantId, branchId, firstName, lastName: 'Колев' },
        }),
      ),
    );
    if (!driver || !idle) {
      throw new Error('Missing drivers');
    }
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        deviceImei: '990601000000040',
        source: 'DEMO',
        recordedAt: asOf,
        receivedAt: asOf,
      },
    });
    // A later sample of another Branch never moves this Branch's window.
    const elsewhere = await database.client.vehicle.create({
      data: { tenantId, branchId: randomUUID(), licensePlate: 'ELSEWHERE' },
    });
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId: elsewhere.branchId,
        vehicleId: elsewhere.id,
        deviceImei: '990601000000041',
        source: 'DEMO',
        recordedAt: days(5),
        receivedAt: days(5),
      },
    });
    const trip = (
      startedAt: Date,
      values: { distanceKm?: number; drivingScore?: number; ecoScore?: number } = {},
    ) => ({
      tenantId,
      branchId,
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
      branchId,
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
        '{fleetDrivers(sort:{field:LAST_NAME,direction:ASC}){items{firstName distance30dKm tripCount30d maneuversPer100Km30d}}}',
        {},
        branchId,
      ),
    ).toEqual({
      data: {
        fleetDrivers: {
          items: [
            { firstName: 'Иван', distance30dKm: 0, tripCount30d: 0, maneuversPer100Km30d: null },
            {
              firstName: 'Мартин',
              distance30dKm: expect.closeTo(150.4, 10),
              tripCount30d: 4,
              maneuversPer100Km30d: expect.closeTo((4 / 150.4) * 100, 10),
            },
          ],
        },
      },
    });
    const scorecard =
      'query($driverId:ID!,$days:Int!){fleetDriverScorecard(driverId:$driverId,days:$days){driver{id tripCount30d} asOf windowStart windowEnd distanceKm tripCount scoredTripCount averageDrivingScore averageEcoScore maneuverCount maneuversPer100Km lowConfidence maneuvers{kind intensity1 intensity2 intensity3 intensityUnknown total}}}';
    const month = await query(scorecard, { driverId: driver.id, days: 30 }, branchId);
    expect(month).toMatchObject({
      data: {
        fleetDriverScorecard: {
          driver: { id: driver.id, tripCount30d: 4 },
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
    expect(JSON.stringify(month)).toContain(
      '{"kind":"HARSH_BRAKING","intensity1":2,"intensity2":0,"intensity3":1,"intensityUnknown":0,"total":3}',
    );
    expect(JSON.stringify(month)).toContain(
      '{"kind":"SPEEDING","intensity1":0,"intensity2":1,"intensity3":0,"intensityUnknown":0,"total":1}',
    );
    expect(await query(scorecard, { driverId: driver.id, days: 7 }, branchId)).toMatchObject({
      data: {
        fleetDriverScorecard: {
          windowStart: days(-7).toISOString(),
          distanceKm: 100,
          tripCount: 2,
          scoredTripCount: 1,
          averageDrivingScore: 80,
          averageEcoScore: 70,
          maneuverCount: 3,
          maneuversPer100Km: expect.closeTo(3, 10),
          lowConfidence: true,
        },
      },
    });
    expect(await query(scorecard, { driverId: idle.id, days: 30 }, branchId)).toMatchObject({
      data: {
        fleetDriverScorecard: {
          tripCount: 0,
          distanceKm: 0,
          averageDrivingScore: null,
          maneuversPer100Km: null,
          lowConfidence: true,
        },
      },
    });
    expect(await query(scorecard, { driverId: driver.id, days: 30 }, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(scorecard, { driverId: driver.id, days: 94 }, branchId)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'days' }] } }],
    });
    expect(await query(remove, { id: driver.id }, branchId)).toMatchObject({
      errors: [
        {
          message: 'Driver is assigned or has trip history; set the driver inactive instead.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
  });
});
