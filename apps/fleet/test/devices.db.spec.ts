import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/graphql/demo-auth.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const create =
  'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id storeId imei vehicleId vehicle{id licensePlate}}}';
const read = 'query($id:ID!){fleetDevice(id:$id){id storeId imei vehicleId vehicle{licensePlate}}}';
const update =
  'mutation($id:ID!,$input:UpdateFleetDeviceInput!){updateFleetDevice(id:$id,input:$input){id imei vehicleId vehicle{licensePlate}}}';
const remove = 'mutation($id:ID!){deleteFleetDevice(id:$id){id}}';
describe('Device GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const requireStore = jest.fn<CoreClient['requireStore']>().mockResolvedValue(undefined);
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireStore })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  beforeEach(() => {
    requireStore.mockClear();
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
    storeId?: string,
    scopeTenantId = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function truck(storeId: string, licensePlate = 'CA1234AB') {
    return database.client.vehicle.create({ data: { tenantId, storeId, licensePlate } });
  }
  it('persists leading zeros, allows multiple devices, reassigns and protects referenced trucks', async () => {
    const storeId = randomUUID();
    const first = await truck(storeId),
      second = await truck(storeId, 'CB5678AB');
    for (const imei of ['001234567890123', '001234567890124'])
      expect(await query(create, { input: { imei, vehicleId: first.id } }, storeId)).toMatchObject({
        data: {
          createFleetDevice: {
            imei,
            storeId,
            vehicleId: first.id,
            vehicle: { licensePlate: first.licensePlate },
          },
        },
      });
    expect(requireStore).toHaveBeenCalledTimes(2);
    const row = await database.client.device.findFirstOrThrow({
      where: { storeId, imei: '001234567890123' },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: first.id }, storeId),
    ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    requireStore.mockClear();
    expect(
      await query(
        update,
        { id: row.id, input: { vehicleId: second.id, imei: '001234567890125' } },
        storeId,
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
    expect(await query(read, { id: row.id }, storeId)).toMatchObject({
      data: { fleetDevice: { imei: '001234567890125' } },
    });
    expect(await query(remove, { id: row.id }, storeId)).toEqual({
      data: { deleteFleetDevice: { id: row.id } },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: second.id }, storeId),
    ).toEqual({ data: { deleteFleetVehicle: { id: second.id } } });
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('rejects duplicate IMEI per store on create/update and retains the existing records', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    const vehicle = await truck(storeId),
      other = await truck(foreign);
    const a = await database.client.device.create({
      data: { tenantId, storeId, vehicleId: vehicle.id, imei: '123456789012345' },
    });
    const b = await database.client.device.create({
      data: { tenantId, storeId, vehicleId: vehicle.id, imei: '123456789012346' },
    });
    for (const [source, variables] of [
      [create, { input: { imei: a.imei, vehicleId: vehicle.id } }],
      [update, { id: b.id, input: { imei: a.imei } }],
    ] satisfies [string, Record<string, unknown>][]) {
      expect(await query(source, variables, storeId)).toMatchObject({
        errors: [{ extensions: { fieldErrors: [{ path: 'imei' }] } }],
      });
    }
    expect(await database.client.device.findUnique({ where: { id: b.id, storeId } })).toEqual(b);
    expect(
      await query(create, { input: { imei: a.imei, vehicleId: other.id } }, foreign),
    ).toMatchObject({ data: { createFleetDevice: { imei: a.imei, storeId: foreign } } });
  });
  it('blocks foreign vehicle assignments in the API and with the composite database constraint', async () => {
    const storeId = randomUUID();
    const own = await truck(storeId),
      foreign = await truck(randomUUID());
    const row = await database.client.device.create({
      data: { tenantId, storeId, vehicleId: own.id, imei: '123456789012345' },
    });
    expect(
      await query(create, { input: { imei: '123456789012346', vehicleId: foreign.id } }, storeId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    expect(
      await query(update, { id: row.id, input: { vehicleId: foreign.id } }, storeId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    await expect(
      database.client.device.create({
        data: { tenantId, storeId, vehicleId: foreign.id, imei: '123456789012347' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await database.client.device.findUnique({ where: { id: row.id, storeId } })).toEqual(
      row,
    );
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('hides foreign device IDs in CRUD and federation references', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    const vehicle = await truck(storeId);
    const row = await database.client.device.create({
      data: { tenantId, storeId, vehicleId: vehicle.id, imei: '123456789012345' },
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
          storeId: foreign,
          imei: 'spoofed',
          vehicleId: randomUUID(),
        },
      ],
    };
    expect(await query(entity, variables, storeId)).toEqual({
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
    const storeId = randomUUID();
    const vehicle = await truck(storeId);
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
      { imei: '123456789012345', vehicleId: vehicle.id, storeId },
    ])
      expect(await query(create, { input }, storeId)).toHaveProperty('errors');
    expect(await database.client.device.count({ where: { storeId } })).toBe(0);
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('scopes list totals, IDs, IMEI search and stable pagination', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    const own = await truck(storeId),
      other = await truck(foreign);
    for (const [scope, vehicleId, imei] of [
      [storeId, own.id, '001234567890123'],
      [storeId, own.id, '001234567890124'],
      [storeId, own.id, '991234567890125'],
      [foreign, other.id, '001234567890123'],
    ] satisfies [string, string, string][])
      await database.client.device.create({ data: { tenantId, storeId: scope, vehicleId, imei } });
    const source =
      'query($search:String,$offset:Int!,$ids:[ID!]){fleetDevices(search:$search,offset:$offset,limit:1,ids:$ids,sort:{field:IMEI,direction:ASC}){items{imei vehicle{licensePlate}}total}}';
    expect(await query(source, { search: '001', offset: 1 }, storeId)).toEqual({
      data: {
        fleetDevices: {
          items: [{ imei: '001234567890124', vehicle: { licensePlate: own.licensePlate } }],
          total: 2,
        },
      },
    });
    expect(await query(source, { search: '%_', offset: 0 }, storeId)).toEqual({
      data: { fleetDevices: { items: [], total: 0 } },
    });
    const foreignDevice = await database.client.device.findFirstOrThrow({
      where: { storeId: foreign },
    });
    expect(await query(source, { offset: 0, ids: [foreignDevice.id] }, storeId)).toEqual({
      data: { fleetDevices: { items: [], total: 0 } },
    });
  });
  it('isolates tenants even when the supplied store ID and IMEI are identical', async () => {
    const storeId = randomUUID(),
      otherTenant = randomUUID();
    const own = await truck(storeId);
    const foreign = await database.client.vehicle.create({
      data: { tenantId: otherTenant, storeId, licensePlate: 'OTHER TENANT' },
    });
    const device = await database.client.device.create({
      data: { tenantId, storeId, vehicleId: own.id, imei: '001234567890999' },
    });
    await database.client.device.create({
      data: { tenantId: otherTenant, storeId, vehicleId: foreign.id, imei: device.imei },
    });
    expect(await query('{fleetDevices{items{id}total}}', {}, storeId)).toEqual({
      data: { fleetDevices: { items: [{ id: device.id }], total: 1 } },
    });
    for (const source of [read, update, remove])
      expect(
        await query(
          source,
          { id: device.id, input: { imei: '001234567890998' } },
          storeId,
          otherTenant,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(create, { input: { imei: '001234567890997', vehicleId: foreign.id } }, storeId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'vehicleId' }] } }] });
    await expect(
      database.client.device.create({
        data: { tenantId, storeId, vehicleId: foreign.id, imei: '001234567890996' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await database.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
    const entities =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id}}}';
    expect(
      await query(
        entities,
        { refs: [{ __typename: 'FleetVehicle', id: own.id, tenantId: otherTenant }] },
        storeId,
        otherTenant,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
  });
});
