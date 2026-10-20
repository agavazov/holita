import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';
import { afterLockedDriverChange } from './driver-row-lock.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const create =
  'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id branchId licensePlate notes}}';
const read = 'query($id:ID!){fleetVehicle(id:$id){id branchId licensePlate notes}}';
const update =
  'mutation($id:ID!,$input:UpdateFleetVehicleInput!){updateFleetVehicle(id:$id,input:$input){id licensePlate notes}}';
const remove = 'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}';
describe('Vehicle GraphQL with PostgreSQL', () => {
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
  async function query(source: string, variables: Record<string, unknown>, branchId?: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('persists two fields, preserves multiline notes, clears notes and deletes without a core read check', async () => {
    const branchId = randomUUID();
    expect(
      await query(
        create,
        { input: { licensePlate: ' CA1234AB ', notes: ' First\nSecond ' } },
        branchId,
      ),
    ).toMatchObject({
      data: {
        createFleetVehicle: { branchId, licensePlate: 'CA1234AB', notes: 'First\nSecond' },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    const row = await database.client.vehicle.findFirstOrThrow({ where: { branchId } });
    requireBranch.mockClear();
    expect(await query(update, { id: row.id, input: { notes: null } }, branchId)).toMatchObject({
      data: { updateFleetVehicle: { licensePlate: 'CA1234AB', notes: null } },
    });
    expect(await query(remove, { id: row.id }, branchId)).toEqual({
      data: { deleteFleetVehicle: { id: row.id } },
    });
    expect(
      await database.client.vehicle.findUnique({ where: { id: row.id, branchId } }),
    ).toBeNull();
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('hides foreign IDs in CRUD and resolves federation references from the scoped database', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const row = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'OWNER' },
    });
    for (const source of [read, update, remove]) {
      expect(
        await query(source, { id: row.id, input: { licensePlate: 'Wrong' } }, foreign),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
    const entity =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id branchId licensePlate}}}';
    const variables = {
      refs: [
        { __typename: 'FleetVehicle', id: row.id, branchId: foreign, licensePlate: 'Spoofed' },
      ],
    };
    expect(await query(entity, variables, branchId)).toEqual({
      data: { _entities: [{ id: row.id, branchId, licensePlate: 'OWNER' }] },
    });
    expect(await query(entity, variables, foreign)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await database.client.vehicle.findUnique({ where: { id: row.id, branchId } })).toEqual(
      row,
    );
  });
  it('requires scope and rejects invalid inputs without persistence', async () => {
    const branchId = randomUUID();
    expect(await query(create, { input: { licensePlate: 'CA1234AB' } })).toHaveProperty('errors');
    for (const input of [
      { licensePlate: ' ' },
      { licensePlate: 'A'.repeat(33) },
      { licensePlate: 'A\u0000' },
      { licensePlate: 'CA1234AB', notes: 'A'.repeat(2001) },
      { licensePlate: 'CA1234AB', branchId },
    ]) {
      expect(await query(create, { input }, branchId)).toHaveProperty('errors');
    }
    expect(await database.client.vehicle.count({ where: { branchId } })).toBe(0);
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('scopes totals, applies stable pagination and treats search punctuation literally', async () => {
    const branchId = randomUUID();
    await database.client.vehicle.createMany({
      data: [
        { tenantId, branchId, licensePlate: 'CA100%_AB' },
        { tenantId, branchId, licensePlate: 'CA2000AB' },
        { tenantId, branchId, licensePlate: 'CA3000AB' },
        { tenantId, branchId: randomUUID(), licensePlate: 'CAFOREIGN' },
      ],
    });
    const source =
      'query($search:String,$offset:Int!,$limit:Int!){fleetVehicles(search:$search,offset:$offset,limit:$limit,sort:{field:LICENSE_PLATE,direction:ASC}){items{licensePlate}total}}';
    expect(await query(source, { search: 'ca', offset: 1, limit: 1 }, branchId)).toEqual({
      data: { fleetVehicles: { items: [{ licensePlate: 'CA2000AB' }], total: 3 } },
    });
    expect(await query(source, { search: '%_', offset: 0, limit: 20 }, branchId)).toEqual({
      data: { fleetVehicles: { items: [{ licensePlate: 'CA100%_AB' }], total: 1 } },
    });
    expect(requireBranch).not.toHaveBeenCalled();
  });

  const details =
    'id licensePlate fleetNumber vehicleType make model modelYear vin fuelType fuelTankCapacityL status groupId group{id name colorToken} currentDriverId currentDriver{id firstName lastName employeeNumber status} deviceCount';
  it('round-trips the master data fields with stored group and driver references', async () => {
    const branchId = randomUUID();
    const group = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Long haul', colorToken: 'C3' },
    });
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'Георги', lastName: 'Иванов', employeeNumber: 'E-7' },
    });
    const created = await query(
      `mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){${details}}}`,
      {
        input: {
          licensePlate: 'CB 1001 AX',
          fleetNumber: ' T-01 ',
          vehicleType: 'TRACTOR',
          make: 'Mercedes-Benz',
          model: 'Actros',
          modelYear: 2021,
          vin: ' wdb9634031l123456 ',
          fuelType: 'DIESEL',
          fuelTankCapacityL: 800,
          groupId: group.id,
          currentDriverId: driver.id,
        },
      },
      branchId,
    );
    expect(created).toMatchObject({
      data: {
        createFleetVehicle: {
          fleetNumber: 'T-01',
          vehicleType: 'TRACTOR',
          modelYear: 2021,
          vin: 'WDB9634031L123456',
          fuelType: 'DIESEL',
          fuelTankCapacityL: 800,
          status: 'ACTIVE',
          groupId: group.id,
          group: { id: group.id, name: 'Long haul', colorToken: 'C3' },
          currentDriverId: driver.id,
          currentDriver: {
            id: driver.id,
            firstName: 'Георги',
            lastName: 'Иванов',
            employeeNumber: 'E-7',
            status: 'ACTIVE',
          },
          deviceCount: 0,
        },
      },
    });
    const id = (await database.client.vehicle.findFirstOrThrow({ where: { branchId } })).id;
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId: id, imei: '001234567890123' },
    });
    expect(
      await query(
        `query($id:ID!){fleetVehicle(id:$id){deviceCount group{name}}}`,
        { id },
        branchId,
      ),
    ).toEqual({ data: { fleetVehicle: { deviceCount: 1, group: { name: 'Long haul' } } } });
    expect(
      await query(
        `mutation($id:ID!){updateFleetVehicle(id:$id,input:{groupId:null,make:null,vehicleType:null}){groupId group{id} make vehicleType fleetNumber}}`,
        { id },
        branchId,
      ),
    ).toEqual({
      data: {
        updateFleetVehicle: {
          groupId: null,
          group: null,
          make: null,
          vehicleType: null,
          fleetNumber: 'T-01',
        },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
  });

  it('reports duplicate fleet numbers and VINs per Branch and keeps other Branches independent', async () => {
    const branchId = randomUUID(),
      otherBranch = randomUUID();
    const existing = await database.client.vehicle.create({
      data: {
        tenantId,
        branchId,
        licensePlate: 'A',
        fleetNumber: 'T-01',
        vin: 'WDB9634031L123456',
      },
    });
    const other = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'B' },
    });
    const create = `mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id fleetNumber}}`;
    expect(
      await query(
        create,
        { input: { licensePlate: 'C', fleetNumber: 'T-01', vin: 'wdb9634031l123456' } },
        branchId,
      ),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'fleetNumber' }, { path: 'vin' }],
          },
        },
      ],
    });
    expect(
      await query(
        `mutation($id:ID!){updateFleetVehicle(id:$id,input:{fleetNumber:"T-01"}){id}}`,
        { id: other.id },
        branchId,
      ),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'fleetNumber' }] } }] });
    expect(
      await query(
        `mutation($id:ID!){updateFleetVehicle(id:$id,input:{fleetNumber:"T-01",licensePlate:"A2"}){fleetNumber licensePlate}}`,
        { id: existing.id },
        branchId,
      ),
    ).toEqual({ data: { updateFleetVehicle: { fleetNumber: 'T-01', licensePlate: 'A2' } } });
    expect(
      await query(create, { input: { licensePlate: 'D', fleetNumber: 'T-01' } }, otherBranch),
    ).toMatchObject({ data: { createFleetVehicle: { fleetNumber: 'T-01' } } });
  });

  it('accepts only groups and active drivers of the Branch, enforces INACTIVE without a driver and deactivates', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const foreignGroup = await database.client.vehicleGroup.create({
      data: { tenantId, branchId: foreign, name: 'Foreign' },
    });
    const foreignDriver = await database.client.driver.create({
      data: { tenantId, branchId: foreign, firstName: 'F', lastName: 'Driver' },
    });
    const inactiveDriver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'I', lastName: 'Driver', status: 'INACTIVE' },
    });
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'A', lastName: 'Driver' },
    });
    const create = `mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}`;
    for (const [input, path] of [
      [{ licensePlate: 'X', groupId: foreignGroup.id }, 'groupId'],
      [{ licensePlate: 'X', currentDriverId: foreignDriver.id }, 'currentDriverId'],
      [{ licensePlate: 'X', currentDriverId: inactiveDriver.id }, 'currentDriverId'],
      [{ licensePlate: 'X', status: 'INACTIVE', currentDriverId: driver.id }, 'currentDriverId'],
    ] satisfies [Record<string, unknown>, string][]) {
      expect(await query(create, { input }, branchId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    }
    expect(await database.client.vehicle.count({ where: { branchId } })).toBe(0);
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'ASSIGNED', currentDriverId: driver.id },
    });
    expect(
      await query(
        `mutation($id:ID!){updateFleetVehicle(id:$id,input:{status:INACTIVE}){id}}`,
        { id: vehicle.id },
        branchId,
      ),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'currentDriverId' }] } }] });
    await expect(
      database.client.vehicle.update({ where: { id: vehicle.id }, data: { status: 'INACTIVE' } }),
    ).rejects.toThrow();
    const deactivate = `mutation($id:ID!){deactivateFleetVehicle(id:$id){status currentDriverId currentDriver{id}}}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await query(deactivate, { id: vehicle.id }, branchId)).toEqual({
        data: {
          deactivateFleetVehicle: {
            status: 'INACTIVE',
            currentDriverId: null,
            currentDriver: null,
          },
        },
      });
    }
    expect(await query(deactivate, { id: vehicle.id }, foreign)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei: '001234567890555' },
    });
    expect(
      await query(
        `mutation($id:ID!){deleteFleetVehicle(id:$id){id}}`,
        { id: vehicle.id },
        branchId,
      ),
    ).toMatchObject({
      errors: [
        {
          message: 'Vehicle has devices or history; deactivate it instead.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
  });

  it('rejects create and update assignments when driver deactivation commits while they wait', async () => {
    const branchId = randomUUID();
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'D', lastName: 'Concurrent deactivation' },
    });
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'CB 4003 AX' },
    });
    const responses = await afterLockedDriverChange(
      database,
      { tenantId, branchId },
      driver.id,
      (transaction) =>
        transaction.driver.update({
          where: { id: driver.id, tenantId, branchId },
          data: { status: 'INACTIVE' },
        }),
      () =>
        Promise.all([
          query(
            create,
            { input: { licensePlate: 'CB 4004 AX', currentDriverId: driver.id } },
            branchId,
          ),
          query(update, { id: vehicle.id, input: { currentDriverId: driver.id } }, branchId),
        ]),
      2,
    );
    for (const response of responses) {
      expect(response).toMatchObject({
        errors: [
          {
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [
                { path: 'currentDriverId', message: 'Choose an active driver in this branch.' },
              ],
            },
          },
        ],
      });
    }
    expect(await database.client.vehicle.count({ where: { tenantId, branchId } })).toBe(1);
    expect(
      await database.client.vehicle.count({
        where: { tenantId, branchId, currentDriverId: driver.id },
      }),
    ).toBe(0);
    expect(
      await database.client.driver.findUniqueOrThrow({
        where: { id: driver.id, tenantId, branchId },
        select: { status: true },
      }),
    ).toEqual({ status: 'INACTIVE' });
  });

  it('filters, sorts with nulls last, searches tokens case-insensitively and pages consistently in scope', async () => {
    const branchId = randomUUID(),
      otherTenant = randomUUID();
    const group = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'G' },
    });
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'D', lastName: 'River' },
    });
    // Rows without a fleet number tie; the final `id DESC` key orders them.
    const [higherId = '', lowerId = ''] = [randomUUID(), randomUUID()].sort().reverse();
    const rows = [
      { licensePlate: 'СА 7712 КН', fleetNumber: 'Т-02', make: 'Волво', vehicleType: 'TRACTOR' },
      { licensePlate: 'CA7712KH', fleetNumber: 'A-01', make: 'Volvo', groupId: group.id },
      {
        id: higherId,
        licensePlate: 'CB 1001 AX',
        fleetNumber: null,
        make: 'MAN',
        currentDriverId: driver.id,
      },
      { licensePlate: 'CB 50%_\\ AX', fleetNumber: 'B-01', status: 'IN_WORKSHOP' },
      { id: lowerId, licensePlate: 'PB 0001 AA', fleetNumber: null, status: 'INACTIVE' },
    ] as const;
    for (const row of rows) {
      await database.client.vehicle.create({ data: { tenantId, branchId, ...row } });
    }
    await database.client.vehicle.create({
      data: { tenantId, branchId: randomUUID(), licensePlate: 'CA7712KH OTHER BRANCH' },
    });
    await database.client.vehicle.create({
      data: { tenantId: otherTenant, branchId, licensePlate: 'CA7712KH OTHER TENANT' },
    });
    const withDevice = await database.client.vehicle.findFirstOrThrow({
      where: { branchId, licensePlate: 'CB 1001 AX' },
    });
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId: withDevice.id, imei: '001234567890777' },
    });
    const source =
      'query($search:String,$filter:FleetVehicleFilter,$sort:FleetVehicleSort,$offset:Int!,$limit:Int!){fleetVehicles(search:$search,filter:$filter,sort:$sort,offset:$offset,limit:$limit){items{licensePlate}total offset limit}}';
    async function plates(variables: Record<string, unknown>) {
      const body = await query(source, { offset: 0, limit: 20, ...variables }, branchId);
      expect(body).not.toHaveProperty('errors');
      return body;
    }
    function page(licensePlates: string[], total = licensePlates.length, offset = 0, limit = 20) {
      return {
        data: {
          fleetVehicles: {
            items: licensePlates.map((licensePlate) => ({ licensePlate })),
            total,
            offset,
            limit,
          },
        },
      };
    }
    expect(await plates({ sort: { field: 'FLEET_NUMBER', direction: 'ASC' } })).toEqual(
      page(['CA7712KH', 'CB 50%_\\ AX', 'СА 7712 КН', 'CB 1001 AX', 'PB 0001 AA']),
    );
    expect(await plates({ sort: { field: 'FLEET_NUMBER', direction: 'DESC' } })).toEqual(
      page(['СА 7712 КН', 'CB 50%_\\ AX', 'CA7712KH', 'CB 1001 AX', 'PB 0001 AA']),
    );
    for (const [offset, licensePlate] of [
      [3, 'CB 1001 AX'],
      [4, 'PB 0001 AA'],
    ] as const) {
      expect(
        await plates({ sort: { field: 'FLEET_NUMBER', direction: 'ASC' }, offset, limit: 1 }),
      ).toEqual(page([licensePlate], 5, offset, 1));
    }
    expect(
      await plates({ search: 'ca 7712', sort: { field: 'LICENSE_PLATE', direction: 'ASC' } }),
    ).toEqual(page(['CA7712KH']));
    expect(await plates({ search: 'са кн волво' })).toEqual(page(['СА 7712 КН']));
    expect(await plates({ search: 'ВОЛВО' })).toEqual(page(['СА 7712 КН']));
    expect(await plates({ search: '%_\\' })).toEqual(page(['CB 50%_\\ AX']));
    expect(await plates({ search: '_' })).toEqual(page(['CB 50%_\\ AX']));
    const byPlate = { field: 'LICENSE_PLATE', direction: 'ASC' };
    expect(
      await plates({ filter: { statuses: ['IN_WORKSHOP', 'INACTIVE'] }, sort: byPlate }),
    ).toEqual(page(['CB 50%_\\ AX', 'PB 0001 AA']));
    expect(await plates({ filter: { vehicleTypes: ['TRACTOR'] } })).toEqual(page(['СА 7712 КН']));
    expect(await plates({ filter: { hasGroup: true } })).toEqual(page(['CA7712KH']));
    expect(await plates({ filter: { groupIds: [group.id] } })).toEqual(page(['CA7712KH']));
    expect(await plates({ filter: { hasDriver: true } })).toEqual(page(['CB 1001 AX']));
    expect(await plates({ filter: { currentDriverIds: [driver.id] } })).toEqual(
      page(['CB 1001 AX']),
    );
    expect(await plates({ filter: { hasDevice: true } })).toEqual(page(['CB 1001 AX']));
    expect(
      await plates({
        filter: { hasDevice: false, hasGroup: false, hasDriver: false },
        sort: byPlate,
      }),
    ).toEqual(page(['CB 50%_\\ AX', 'PB 0001 AA', 'СА 7712 КН']));
    expect(
      await query(source, { offset: 0, limit: 20, filter: { statuses: [] } }, branchId),
    ).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'filter' }] } }],
    });
    expect(
      await query(source, { offset: 0, limit: 20, search: 'a b c d e f' }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'search' }] } }] });
  });

  it('attaches state, open alerts and the next service to a page and filters open alerts', async () => {
    const branchId = randomUUID();
    const asOf = new Date('2026-10-18T06:30:00.000Z');
    const at = (minutes: number) => new Date(asOf.getTime() + minutes * 60_000);
    const [moving, idle, silent] = await Promise.all(
      ['CB 1010 AX', 'CB 1024 AX', 'CB 1037 AX'].map((licensePlate) =>
        database.client.vehicle.create({ data: { tenantId, branchId, licensePlate } }),
      ),
    );
    if (!moving || !idle || !silent) {
      throw new Error('Missing vehicles');
    }
    for (const [vehicle, imei] of [
      [moving, '990601000000010'],
      [silent, '990601000000037'],
    ] as const) {
      await database.client.device.create({
        data: { tenantId, branchId, vehicleId: vehicle.id, imei },
      });
    }
    await database.client.vehicleStatusSample.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId: moving.id,
          deviceImei: '990601000000010',
          source: 'DEMO',
          recordedAt: at(-3),
          receivedAt: at(-3),
          ignition: true,
          speedKph: 82,
          fuelLevelPct: 9,
          odometerKm: 412_345.6,
          address: 'E79',
        },
        {
          tenantId,
          branchId,
          vehicleId: silent.id,
          deviceImei: '990601000000037',
          source: 'DEMO',
          recordedAt: at(-9 * 24 * 60),
          receivedAt: at(-9 * 24 * 60),
          ignition: false,
          fuelLevelPct: 70,
        },
        {
          tenantId,
          branchId,
          vehicleId: silent.id,
          deviceImei: '990601000000099',
          source: 'DEMO',
          recordedAt: asOf,
          receivedAt: asOf,
          ignition: null,
        },
      ],
    });
    // The silent vehicle's newest sample comes from an IMEI it no longer has; it still counts.
    await database.client.device.deleteMany({ where: { branchId, imei: '990601000000037' } });
    await database.client.fleetEvent.createMany({
      data: (['OPEN', 'OPEN', 'ACKNOWLEDGED'] as const).map((alertStatus, index) => ({
        tenantId,
        branchId,
        vehicleId: moving.id,
        source: 'DEMO' as const,
        occurredAt: at(-30 - index),
        kind: 'LOW_FUEL' as const,
        severity: 'WARNING' as const,
        alertStatus,
        acknowledgedAt: alertStatus === 'ACKNOWLEDGED' ? at(-10) : null,
      })),
    });
    const overdue = await database.client.serviceTask.create({
      data: {
        tenantId,
        branchId,
        vehicleId: moving.id,
        serviceType: 'OIL_CHANGE',
        dueOn: new Date('2020-01-01T00:00:00.000Z'),
      },
    });
    await database.client.serviceTask.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId: moving.id,
          serviceType: 'TIRES',
          dueOn: new Date('2099-01-01T00:00:00.000Z'),
        },
        {
          tenantId,
          branchId,
          vehicleId: idle.id,
          serviceType: 'BRAKES',
          status: 'CANCELLED',
        },
      ],
    });
    const derived =
      'id licensePlate deviceCount openAlertCount state{activity lastReportedAt speedKph fuelLevelPct fuelStatus address odometerKm odometerSource} nextService{id serviceType status urgency vehicle{licensePlate}}';
    const list = `query($filter:FleetVehicleFilter){fleetVehicles(filter:$filter,sort:{field:LICENSE_PLATE,direction:ASC}){items{${derived}}total}}`;
    expect(await query(list, {}, branchId)).toEqual({
      data: {
        fleetVehicles: {
          items: [
            {
              id: moving.id,
              licensePlate: 'CB 1010 AX',
              deviceCount: 1,
              openAlertCount: 2,
              state: {
                activity: 'MOVING',
                lastReportedAt: at(-3).toISOString(),
                speedKph: 82,
                fuelLevelPct: 9,
                fuelStatus: 'LOW',
                address: 'E79',
                odometerKm: 412_345.6,
                odometerSource: 'DEMO',
              },
              nextService: {
                id: overdue.id,
                serviceType: 'OIL_CHANGE',
                status: 'PLANNED',
                urgency: 'OVERDUE',
                vehicle: { licensePlate: 'CB 1010 AX' },
              },
            },
            {
              id: idle.id,
              licensePlate: 'CB 1024 AX',
              deviceCount: 0,
              openAlertCount: 0,
              state: {
                activity: 'NO_DEVICE',
                lastReportedAt: null,
                speedKph: null,
                fuelLevelPct: null,
                fuelStatus: 'NO_DATA',
                address: null,
                odometerKm: null,
                odometerSource: null,
              },
              nextService: null,
            },
            {
              id: silent.id,
              licensePlate: 'CB 1037 AX',
              deviceCount: 0,
              openAlertCount: 0,
              state: {
                activity: 'NO_DEVICE',
                lastReportedAt: asOf.toISOString(),
                speedKph: null,
                fuelLevelPct: null,
                fuelStatus: 'NO_DATA',
                address: null,
                odometerKm: null,
                odometerSource: null,
              },
              nextService: null,
            },
          ],
          total: 3,
        },
      },
    });
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId: silent.id, imei: '990601000000037' },
    });
    expect(
      await query(
        `query($id:ID!){fleetVehicle(id:$id){state{activity fuelStatus} openAlertCount}}`,
        { id: silent.id },
        branchId,
      ),
    ).toEqual({
      data: {
        fleetVehicle: { state: { activity: 'ASSET', fuelStatus: 'NO_DATA' }, openAlertCount: 0 },
      },
    });
    const plates = (body: unknown) => JSON.stringify(body).match(/CB 10\d\d AX/g);
    expect(plates(await query(list, { filter: { hasOpenAlerts: true } }, branchId))).toEqual([
      'CB 1010 AX',
      'CB 1010 AX',
    ]);
    expect(
      plates(
        await query(
          `query($filter:FleetVehicleFilter){fleetVehicles(filter:$filter,sort:{field:LICENSE_PLATE,direction:ASC}){items{licensePlate}}}`,
          { filter: { hasOpenAlerts: false } },
          branchId,
        ),
      ),
    ).toEqual(['CB 1024 AX', 'CB 1037 AX']);
    // Vehicles with history cannot be deleted.
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: idle.id }, branchId),
    ).toMatchObject({
      errors: [
        {
          message: 'Vehicle has devices or history; deactivate it instead.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
  });
});
