import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const create =
  'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id branchId imei vehicleId vehicle{id licensePlate}}}';
const read =
  'query($id:ID!){fleetDevice(id:$id){id branchId imei vehicleId vehicle{licensePlate}}}';
const update =
  'mutation($id:ID!,$input:UpdateFleetDeviceInput!){updateFleetDevice(id:$id,input:$input){id imei vehicleId vehicle{licensePlate}}}';
const remove = 'mutation($id:ID!){deleteFleetDevice(id:$id){id}}';
describe('Device GraphQL with PostgreSQL', () => {
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
  async function query(
    source: string,
    variables: Record<string, unknown>,
    branchId?: string,
    scopeTenantId = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function truck(branchId: string, licensePlate = 'CA1234AB') {
    return database.client.vehicle.create({ data: { tenantId, branchId, licensePlate } });
  }
  it('persists leading zeros, allows multiple devices, reassigns and protects referenced trucks', async () => {
    const branchId = randomUUID();
    const first = await truck(branchId),
      second = await truck(branchId, 'CB5678AB');
    for (const imei of ['001234567890123', '001234567890124'])
      expect(await query(create, { input: { imei, vehicleId: first.id } }, branchId)).toMatchObject(
        {
          data: {
            createFleetDevice: {
              imei,
              branchId,
              vehicleId: first.id,
              vehicle: { licensePlate: first.licensePlate },
            },
          },
        },
      );
    expect(requireBranch).toHaveBeenCalledTimes(2);
    const row = await database.client.device.findFirstOrThrow({
      where: { branchId, imei: '001234567890123' },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: first.id }, branchId),
    ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    requireBranch.mockClear();
    expect(
      await query(
        update,
        { id: row.id, input: { vehicleId: second.id, imei: '001234567890125' } },
        branchId,
      ),
    ).toMatchObject({
      data: {
        updateFleetDevice: {
          imei: '001234567890125',
          vehicleId: second.id,
          vehicle: { licensePlate: second.licensePlate },
        },
      },
    });
    expect(await query(read, { id: row.id }, branchId)).toMatchObject({
      data: { fleetDevice: { imei: '001234567890125' } },
    });
    expect(await query(remove, { id: row.id }, branchId)).toEqual({
      data: { deleteFleetDevice: { id: row.id } },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: second.id }, branchId),
    ).toEqual({ data: { deleteFleetVehicle: { id: second.id } } });
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('rejects duplicate IMEI per branch on create/update and retains the existing records', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const vehicle = await truck(branchId),
      other = await truck(foreign);
    const a = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei: '123456789012345' },
    });
    const b = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei: '123456789012346' },
    });
    for (const [source, variables] of [
      [create, { input: { imei: a.imei, vehicleId: vehicle.id } }],
      [update, { id: b.id, input: { imei: a.imei } }],
    ] satisfies [string, Record<string, unknown>][]) {
      expect(await query(source, variables, branchId)).toMatchObject({
        errors: [{ extensions: { fieldErrors: [{ path: 'imei' }] } }],
      });
    }
    expect(await database.client.device.findUnique({ where: { id: b.id, branchId } })).toEqual(b);
    expect(
      await query(create, { input: { imei: a.imei, vehicleId: other.id } }, foreign),
    ).toMatchObject({ data: { createFleetDevice: { imei: a.imei, branchId: foreign } } });
  });
  it('blocks foreign vehicle assignments in the API and with the composite database constraint', async () => {
    const branchId = randomUUID();
    const own = await truck(branchId),
      foreign = await truck(randomUUID());
    const row = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: own.id, imei: '123456789012345' },
    });
    expect(
      await query(create, { input: { imei: '123456789012346', vehicleId: foreign.id } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    expect(
      await query(update, { id: row.id, input: { vehicleId: foreign.id } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    await expect(
      database.client.device.create({
        data: { tenantId, branchId, vehicleId: foreign.id, imei: '123456789012347' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await database.client.device.findUnique({ where: { id: row.id, branchId } })).toEqual(
      row,
    );
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('hides foreign device IDs in CRUD and federation references', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const vehicle = await truck(branchId);
    const row = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei: '123456789012345' },
    });
    for (const source of [read, update, remove])
      expect(
        await query(source, { id: row.id, input: { imei: '123456789012346' } }, foreign),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    const entity =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetDevice{id imei vehicle{licensePlate}}}}';
    const variables = {
      refs: [
        {
          __typename: 'FleetDevice',
          id: row.id,
          branchId: foreign,
          imei: 'spoofed',
          vehicleId: randomUUID(),
        },
      ],
    };
    expect(await query(entity, variables, branchId)).toEqual({
      data: {
        _entities: [
          { id: row.id, imei: row.imei, vehicle: { licensePlate: vehicle.licensePlate } },
        ],
      },
    });
    expect(await query(entity, variables, foreign)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
  });
  it('requires scope, valid IMEI and a mandatory truck without writing', async () => {
    const branchId = randomUUID();
    const vehicle = await truck(branchId);
    expect(
      await query(create, { input: { imei: '123456789012345', vehicleId: vehicle.id } }),
    ).toHaveProperty('errors');
    for (const input of [
      { imei: '12345678901234', vehicleId: vehicle.id },
      { imei: '12345678901234A', vehicleId: vehicle.id },
      { imei: '1234567890123456', vehicleId: vehicle.id },
      { imei: '123456789012345' },
      { imei: '123456789012345', vehicleId: null },
      { imei: '123456789012345', vehicleId: randomUUID() },
      { imei: '123456789012345', vehicleId: vehicle.id, branchId },
    ])
      expect(await query(create, { input }, branchId)).toHaveProperty('errors');
    expect(await database.client.device.count({ where: { branchId } })).toBe(0);
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('scopes list totals, IDs, IMEI search and stable pagination', async () => {
    const branchId = randomUUID(),
      foreign = randomUUID();
    const own = await truck(branchId),
      other = await truck(foreign);
    for (const [scope, vehicleId, imei] of [
      [branchId, own.id, '001234567890123'],
      [branchId, own.id, '001234567890124'],
      [branchId, own.id, '991234567890125'],
      [foreign, other.id, '001234567890123'],
    ] satisfies [string, string, string][])
      await database.client.device.create({ data: { tenantId, branchId: scope, vehicleId, imei } });
    const source =
      'query($search:String,$offset:Int!,$ids:[ID!]){fleetDevices(search:$search,offset:$offset,limit:1,ids:$ids,sort:{field:IMEI,direction:ASC}){items{imei vehicle{licensePlate}}total}}';
    expect(await query(source, { search: '001', offset: 1 }, branchId)).toEqual({
      data: {
        fleetDevices: {
          items: [{ imei: '001234567890124', vehicle: { licensePlate: own.licensePlate } }],
          total: 2,
        },
      },
    });
    expect(await query(source, { search: '%_', offset: 0 }, branchId)).toEqual({
      data: { fleetDevices: { items: [], total: 0 } },
    });
    const foreignDevice = await database.client.device.findFirstOrThrow({
      where: { branchId: foreign },
    });
    expect(await query(source, { offset: 0, ids: [foreignDevice.id] }, branchId)).toEqual({
      data: { fleetDevices: { items: [], total: 0 } },
    });
  });
  it('isolates tenants even when the supplied branch ID and IMEI are identical', async () => {
    const branchId = randomUUID(),
      otherTenant = randomUUID();
    const own = await truck(branchId);
    const foreign = await database.client.vehicle.create({
      data: { tenantId: otherTenant, branchId, licensePlate: 'OTHER TENANT' },
    });
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: own.id, imei: '001234567890999' },
    });
    await database.client.device.create({
      data: { tenantId: otherTenant, branchId, vehicleId: foreign.id, imei: device.imei },
    });
    expect(await query('{fleetDevices{items{id}total}}', {}, branchId)).toEqual({
      data: { fleetDevices: { items: [{ id: device.id }], total: 1 } },
    });
    for (const source of [read, update, remove])
      expect(
        await query(
          source,
          { id: device.id, input: { imei: '001234567890998' } },
          branchId,
          otherTenant,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(create, { input: { imei: '001234567890997', vehicleId: foreign.id } }, branchId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    await expect(
      database.client.device.create({
        data: { tenantId, branchId, vehicleId: foreign.id, imei: '001234567890996' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await database.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
    const entities =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id}}}';
    expect(
      await query(
        entities,
        { refs: [{ __typename: 'FleetVehicle', id: own.id, tenantId: otherTenant }] },
        branchId,
        otherTenant,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
  });
});
