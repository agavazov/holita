import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { DevicesRepository } from '../src/modules/devices/devices.repository.js';
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
    for (const imei of ['001234567890123', '001234567890124']) {
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
    }
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
    for (const source of [read, update, remove]) {
      expect(
        await query(source, { id: row.id, input: { imei: '123456789012346' } }, foreign),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
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
  it('requires scope, valid IMEI and valid optional Vehicle references without writing', async () => {
    const branchId = randomUUID();
    const vehicle = await truck(branchId);
    expect(
      await query(create, { input: { imei: '123456789012345', vehicleId: vehicle.id } }),
    ).toHaveProperty('errors');
    for (const input of [
      { imei: '12345678901234', vehicleId: vehicle.id },
      { imei: '12345678901234A', vehicleId: vehicle.id },
      { imei: '1234567890123456', vehicleId: vehicle.id },
      { imei: '123456789012345', vehicleId: randomUUID() },
      { imei: '123456789012345', vehicleId: vehicle.id, branchId },
    ]) {
      expect(await query(create, { input }, branchId)).toHaveProperty('errors');
    }
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
    ] satisfies [string, string, string][]) {
      await database.client.device.create({ data: { tenantId, branchId: scope, vehicleId, imei } });
    }
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
  it('persists model, options in enum order, SIM data and installation time with the vehicle reference', async () => {
    const branchId = randomUUID();
    const vehicle = await database.client.vehicle.create({
      data: {
        tenantId,
        branchId,
        licensePlate: 'CB 1001 AX',
        fleetNumber: 'T-01',
        vehicleType: 'TRACTOR',
      },
    });
    const fields =
      'imei model options firmwareVersion simPhoneNumber simIccid installedAt notes vehicle{__typename id licensePlate fleetNumber vehicleType status}';
    expect(
      await query(
        `mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){${fields}}}`,
        {
          input: {
            imei: '001234567890123',
            vehicleId: vehicle.id,
            model: 'STARLINK_TRACKER',
            options: ['WIFI', 'CAN', 'CELLULAR_4G'],
            firmwareVersion: ' 2.26.1 ',
            simPhoneNumber: '+359888123456',
            simIccid: '8935901990012345678',
            installedAt: '2026-10-01T09:15:00+03:00',
            notes: ' Cab unit ',
          },
        },
        branchId,
      ),
    ).toEqual({
      data: {
        createFleetDevice: {
          imei: '001234567890123',
          model: 'STARLINK_TRACKER',
          options: ['CELLULAR_4G', 'CAN', 'WIFI'],
          firmwareVersion: '2.26.1',
          simPhoneNumber: '+359888123456',
          simIccid: '8935901990012345678',
          installedAt: '2026-10-01T06:15:00.000Z',
          notes: 'Cab unit',
          vehicle: {
            __typename: 'FleetVehicleRef',
            id: vehicle.id,
            licensePlate: 'CB 1001 AX',
            fleetNumber: 'T-01',
            vehicleType: 'TRACTOR',
            status: 'ACTIVE',
          },
        },
      },
    });
    const device = await database.client.device.findFirstOrThrow({ where: { branchId } });
    const update = `mutation($id:ID!,$input:UpdateFleetDeviceInput!){updateFleetDevice(id:$id,input:$input){model options installedAt}}`;
    for (const [input, path] of [
      [{ model: 'STARLINK_SCOUT' }, 'options'],
      [{ model: null }, 'options'],
      [{ options: ['TEMPERATURE_DS'] }, 'options'],
      [{ installedAt: '2999-01-01T00:00:00Z' }, 'installedAt'],
      [{ installedAt: '2026-10-01T09:15:00' }, 'installedAt'],
      [{ simIccid: '123' }, 'simIccid'],
    ] satisfies [Record<string, unknown>, string][]) {
      expect(await query(update, { id: device.id, input }, branchId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    }
    expect(
      await query(
        update,
        { id: device.id, input: { model: 'STARLINK_SCOUT', options: ['TEMPERATURE_DS', 'IRF'] } },
        branchId,
      ),
    ).toEqual({
      data: {
        updateFleetDevice: {
          model: 'STARLINK_SCOUT',
          options: ['IRF', 'TEMPERATURE_DS'],
          installedAt: '2026-10-01T06:15:00.000Z',
        },
      },
    });
    expect(
      await query(
        update,
        { id: device.id, input: { model: null, options: null, installedAt: null } },
        branchId,
      ),
    ).toEqual({ data: { updateFleetDevice: { model: null, options: [], installedAt: null } } });
  });

  it('filters by model, options and vehicle, searches firmware, SIM and plate, and sorts installation nulls last', async () => {
    const branchId = randomUUID();
    const first = await truck(branchId, 'CB 1001 AX'),
      second = await truck(branchId, 'PB 2002 KM');
    const [higherId = '', lowerId = ''] = [randomUUID(), randomUUID()].sort().reverse();
    const rows = [
      {
        imei: '100000000000001',
        vehicleId: first.id,
        model: 'STARLINK_TRACKER',
        options: ['CELLULAR_4G', 'CAN', 'WIFI'],
        firmwareVersion: '2.26.1',
        installedAt: new Date('2026-05-01T00:00:00Z'),
      },
      {
        imei: '100000000000002',
        vehicleId: first.id,
        model: 'STARLINK_SCOUT',
        options: ['CELLULAR_4G', 'IRF'],
        simPhoneNumber: '+359888000111',
        installedAt: new Date('2026-03-01T00:00:00Z'),
      },
      { id: higherId, imei: '100000000000003', vehicleId: second.id, model: 'OTHER' },
      { id: lowerId, imei: '100000000000004', vehicleId: second.id },
    ] as const;
    for (const row of rows) {
      await database.client.device.create({
        data: { tenantId, branchId, ...row, options: 'options' in row ? [...row.options] : [] },
      });
    }
    const foreignBranch = randomUUID();
    await database.client.device.create({
      data: {
        tenantId,
        branchId: foreignBranch,
        vehicleId: (await truck(foreignBranch, 'CB 1001 AX')).id,
        imei: '100000000000001',
        firmwareVersion: '2.26.1',
      },
    });
    const source =
      'query($search:String,$filter:FleetDeviceFilter,$sort:FleetDeviceSort){fleetDevices(search:$search,filter:$filter,sort:$sort){items{imei}total}}';
    async function imeis(variables: Record<string, unknown>) {
      return query(source, variables, branchId);
    }
    function page(values: string[]) {
      return {
        data: { fleetDevices: { items: values.map((imei) => ({ imei })), total: values.length } },
      };
    }
    expect(await imeis({ sort: { field: 'INSTALLED_AT', direction: 'ASC' } })).toEqual(
      page(['100000000000002', '100000000000001', '100000000000003', '100000000000004']),
    );
    expect(await imeis({ sort: { field: 'INSTALLED_AT', direction: 'DESC' } })).toEqual(
      page(['100000000000001', '100000000000002', '100000000000003', '100000000000004']),
    );
    const byImei = { field: 'IMEI', direction: 'ASC' };
    expect(await imeis({ filter: { models: ['STARLINK_SCOUT', 'OTHER'] }, sort: byImei })).toEqual(
      page(['100000000000002', '100000000000003']),
    );
    expect(await imeis({ filter: { options: ['CELLULAR_4G', 'CAN'] } })).toEqual(
      page(['100000000000001']),
    );
    expect(await imeis({ filter: { options: ['CELLULAR_4G'] }, sort: byImei })).toEqual(
      page(['100000000000001', '100000000000002']),
    );
    expect(await imeis({ filter: { vehicleIds: [second.id] }, sort: byImei })).toEqual(
      page(['100000000000003', '100000000000004']),
    );
    expect(await imeis({ search: '2.26' })).toEqual(page(['100000000000001']));
    expect(await imeis({ search: '888000' })).toEqual(page(['100000000000002']));
    expect(await imeis({ search: 'pb 2002', sort: byImei })).toEqual(
      page(['100000000000003', '100000000000004']),
    );
    expect(await imeis({ search: 'cb 0000000000002' })).toEqual(page(['100000000000002']));
    expect(await imeis({ filter: { vehicleIds: [] } })).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'filter' }] } }],
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
    for (const source of [read, update, remove]) {
      expect(
        await query(
          source,
          { id: device.id, input: { imei: '001234567890998' } },
          branchId,
          otherTenant,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
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

  it('registers stock, assigns and releases it while retaining scope, IMEI and restrictive references', async () => {
    const branchId = randomUUID();
    const vehicle = await truck(branchId);
    for (const input of [
      { imei: '000000000000001' },
      { imei: '000000000000002', vehicleId: null },
    ]) {
      expect(await query(create, { input }, branchId)).toMatchObject({
        data: {
          createFleetDevice: {
            imei: input.imei,
            vehicleId: null,
            vehicle: null,
          },
        },
      });
    }
    const device = await database.client.device.findFirstOrThrow({
      where: { tenantId, branchId, imei: '000000000000001' },
    });
    expect(
      await query(update, { id: device.id, input: { vehicleId: vehicle.id } }, branchId),
    ).toMatchObject({
      data: {
        updateFleetDevice: {
          vehicleId: vehicle.id,
          vehicle: { licensePlate: vehicle.licensePlate },
        },
      },
    });
    await expect(
      database.client.vehicle.delete({ where: { id: vehicle.id, tenantId, branchId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(
      await query(update, { id: device.id, input: { vehicleId: null } }, branchId),
    ).toMatchObject({
      data: { updateFleetDevice: { vehicleId: null, vehicle: null } },
    });
    await database.client.vehicle.delete({ where: { id: vehicle.id, tenantId, branchId } });
    const source =
      'query($id:ID!){fleetDevice(id:$id){imei vehicleId vehicle{id} model status lastReportedAt}}';
    expect(await query(source, { id: device.id }, branchId)).toEqual({
      data: {
        fleetDevice: {
          imei: device.imei,
          vehicleId: null,
          vehicle: null,
          model: null,
          status: 'IN_STOCK',
          lastReportedAt: null,
        },
      },
    });
  });

  it('filters and sorts current reporting before paging, counts the Branch exactly and settles batch deletions', async () => {
    const branchId = randomUUID();
    const alpha = await truck(branchId, 'ALPHA'),
      beta = await truck(branchId, 'BETA');
    const asOf = new Date('2026-10-20T10:00:00.000Z');
    const boundary = new Date(asOf.getTime() - 48 * 3_600_000);
    const rows = await Promise.all(
      (
        [
          {
            imei: '000000000000011',
            vehicleId: alpha.id,
            model: 'STARLINK_TRACKER',
            firmwareVersion: '1_2',
          },
          {
            imei: '000000000000012',
            vehicleId: beta.id,
            model: 'STARLINK_SCOUT',
            firmwareVersion: '1X2',
          },
          { imei: '000000000000013', vehicleId: alpha.id, model: 'OTHER', firmwareVersion: null },
          { imei: '000000000000014', vehicleId: alpha.id, model: null, firmwareVersion: null },
          { imei: '000000000000015', vehicleId: null, model: null, firmwareVersion: null },
        ] as const
      ).map((data) => database.client.device.create({ data: { tenantId, branchId, ...data } })),
    );
    const [online, edge, old, silent, stock] = rows;
    if (!online || !edge || !old || !silent || !stock) {
      throw new Error('Missing device fixtures.');
    }
    for (const [device, vehicleId, recordedAt] of [
      [online, alpha.id, asOf],
      [edge, beta.id, boundary],
      [old, alpha.id, new Date(boundary.getTime() - 1)],
      [stock, alpha.id, asOf],
    ] as const) {
      await database.client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          deviceImei: device.imei,
          source: 'DEMO',
          recordedAt,
          receivedAt: recordedAt,
        },
      });
    }
    const foreignBranch = randomUUID();
    const foreignVehicle = await truck(foreignBranch);
    const foreignDevice = await database.client.device.create({
      data: {
        tenantId,
        branchId: foreignBranch,
        vehicleId: foreignVehicle.id,
        imei: online.imei,
      },
    });
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, foreignBranch],
      [randomUUID(), branchId],
    ] as const) {
      const other = await database.client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'FOREIGN CLOCK' },
      });
      await database.client.vehicleStatusSample.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: other.id,
          deviceImei: '000000000000099',
          source: 'DEMO',
          recordedAt: new Date(asOf.getTime() + 100 * 3_600_000),
          receivedAt: asOf,
        },
      });
    }
    const list = `query($filter:FleetDeviceFilter,$sort:FleetDeviceSort,$offset:Int!=0,$limit:Int!=20,$search:String){
      fleetDevices(filter:$filter,sort:$sort,offset:$offset,limit:$limit,search:$search){items{id imei status lastReportedAt vehicleId}total}}`;
    expect(
      await query(
        list,
        {
          filter: { allOf: [{ statuses: ['ONLINE'] }] },
          sort: { field: 'LAST_REPORTED_AT', direction: 'DESC' },
          offset: 1,
          limit: 1,
        },
        branchId,
      ),
    ).toEqual({
      data: {
        fleetDevices: {
          total: 2,
          items: [
            {
              id: edge.id,
              imei: edge.imei,
              status: 'ONLINE',
              lastReportedAt: boundary.toISOString(),
              vehicleId: beta.id,
            },
          ],
        },
      },
    });
    expect(
      await query(
        list,
        { sort: { field: 'LAST_REPORTED_AT', direction: 'ASC' }, limit: 1 },
        branchId,
      ),
    ).toMatchObject({
      data: { fleetDevices: { total: 5, items: [{ id: old.id, status: 'OFFLINE' }] } },
    });
    expect(
      await query(
        list,
        { sort: { field: 'VEHICLE_LICENSE_PLATE', direction: 'DESC' }, limit: 1 },
        branchId,
      ),
    ).toMatchObject({ data: { fleetDevices: { items: [{ id: edge.id }] } } });
    const onlineOrder = [online.id, edge.id]
      .sort()
      .reverse()
      .map((id) => ({ id, status: 'ONLINE' }));
    const offlineOrder = [old.id, silent.id]
      .sort()
      .reverse()
      .map((id) => ({ id, status: 'OFFLINE' }));
    const stockOrder = [{ id: stock.id, status: 'IN_STOCK', lastReportedAt: null }];
    for (const [direction, ordered] of [
      ['ASC', [...onlineOrder, ...offlineOrder, ...stockOrder]],
      ['DESC', [...stockOrder, ...offlineOrder, ...onlineOrder]],
    ] as const) {
      expect(await query(list, { sort: { field: 'STATUS', direction } }, branchId)).toMatchObject({
        data: { fleetDevices: { total: 5, items: ordered } },
      });
      expect(
        await query(list, { sort: { field: 'STATUS', direction }, offset: 1, limit: 3 }, branchId),
      ).toMatchObject({
        data: { fleetDevices: { total: 5, items: ordered.slice(1, 4) } },
      });
    }
    for (const [allOf, total] of [
      [[{ hasVehicle: false }], 1],
      [[{ excludedModels: ['STARLINK_TRACKER'] }], 4],
      [[{ firmwareVersionStartsWith: '1_' }], 1],
      [[{ firmwareVersionStartsWith: '%' }], 0],
      [[{ firmwareVersionNotEquals: '1_2' }], 4],
      [[{ models: ['STARLINK_TRACKER'] }, { models: ['STARLINK_SCOUT'] }], 0],
      [[{ statuses: ['ONLINE'] }, { excludedStatuses: ['ONLINE'] }], 0],
    ] satisfies [Record<string, unknown>[], number][]) {
      expect(await query(list, { filter: { allOf } }, branchId)).toMatchObject({
        data: { fleetDevices: { total } },
      });
    }
    const summary = '{fleetDeviceSummary{dataAsOf online offline inStock}}';
    expect(await query(summary, {}, branchId)).toEqual({
      data: {
        fleetDeviceSummary: { dataAsOf: asOf.toISOString(), online: 2, offline: 2, inStock: 1 },
      },
    });
    expect(await query(summary, {}, randomUUID())).toEqual({
      data: { fleetDeviceSummary: { dataAsOf: null, online: 0, offline: 0, inStock: 0 } },
    });
    const deleted = await query(
      'mutation($ids:[ID!]!){deleteFleetDevices(ids:$ids){succeededIds failures{id code message}}}',
      { ids: [online.id, foreignDevice.id, stock.id] },
      branchId,
    );
    expect(deleted).toEqual({
      data: {
        deleteFleetDevices: {
          succeededIds: [online.id, stock.id],
          failures: [{ id: foreignDevice.id, code: 'NOT_FOUND', message: 'Device not found' }],
        },
      },
    });
    expect(
      await database.client.device.findUnique({ where: { id: foreignDevice.id } }),
    ).not.toBeNull();
    expect(
      await database.client.vehicleStatusSample.count({
        where: { tenantId, branchId, deviceImei: online.imei },
      }),
    ).toBe(1);
  });

  it('returns the same filtered Device facts when a new report arrives after list selection', async () => {
    if (!app) {
      throw new Error('Missing Fleet application.');
    }
    const branchId = randomUUID();
    const vehicle = await truck(branchId, 'SNAPSHOT'),
      clockVehicle = await truck(branchId, 'CLOCK');
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei: '000000000000031' },
    });
    const asOf = new Date('2026-10-18T06:00:00.000Z');
    const oldReport = new Date(asOf.getTime() - 49 * 3_600_000);
    for (const [vehicleId, deviceImei, recordedAt] of [
      [vehicle.id, device.imei, oldReport],
      [clockVehicle.id, '000000000000032', asOf],
    ] as const) {
      await database.client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          deviceImei,
          recordedAt,
          receivedAt: recordedAt,
          source: 'DEMO',
        },
      });
    }
    const repository = app.get(DevicesRepository);
    const originalList = repository.list.bind(repository);
    const freshReport = new Date(asOf.getTime() + 60_000);
    const selected = jest
      .spyOn(repository, 'list')
      .mockImplementationOnce(async (scope, page, criteria, sort) => {
        const result = await originalList(scope, page, criteria, sort);
        await database.client.vehicleStatusSample.create({
          data: {
            tenantId,
            branchId,
            vehicleId: vehicle.id,
            deviceImei: device.imei,
            recordedAt: freshReport,
            receivedAt: freshReport,
            source: 'DEMO',
          },
        });
        return result;
      });
    const list =
      'query($filter:FleetDeviceFilter!){fleetDevices(filter:$filter,sort:{field:LAST_REPORTED_AT,direction:DESC}){items{id status lastReportedAt}total}}';
    try {
      expect(
        await query(list, { filter: { allOf: [{ statuses: ['OFFLINE'] }] } }, branchId),
      ).toEqual({
        data: {
          fleetDevices: {
            total: 1,
            items: [{ id: device.id, status: 'OFFLINE', lastReportedAt: oldReport.toISOString() }],
          },
        },
      });
      expect(
        await query(list, { filter: { allOf: [{ statuses: ['ONLINE'] }] } }, branchId),
      ).toEqual({
        data: {
          fleetDevices: {
            total: 1,
            items: [{ id: device.id, status: 'ONLINE', lastReportedAt: freshReport.toISOString() }],
          },
        },
      });
    } finally {
      selected.mockRestore();
    }
  });

  it('reports lastReportedAt for the current (vehicle, IMEI) pair and keeps history on deletion', async () => {
    const branchId = randomUUID();
    const first = await truck(branchId, 'CB 1001 AX'),
      second = await truck(branchId, 'CB 1002 AX');
    const imei = '990601000000001';
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: first.id, imei },
    });
    const otherTenant = randomUUID();
    const elsewhere = await database.client.vehicle.create({
      data: { tenantId: otherTenant, branchId, licensePlate: 'OTHER' },
    });
    const sample = (vehicleId: string, deviceImei: string, recordedAt: string) => ({
      tenantId,
      branchId,
      vehicleId,
      deviceImei,
      source: 'DEMO' as const,
      recordedAt: new Date(recordedAt),
      receivedAt: new Date(recordedAt),
    });
    await database.client.vehicleStatusSample.createMany({
      data: [
        sample(first.id, imei, '2026-10-18T05:00:00.000Z'),
        sample(first.id, imei, '2026-10-18T06:00:00.000Z'),
        // Another device on the same vehicle and the same IMEI elsewhere do not count.
        sample(first.id, '990601000000002', '2026-10-18T06:30:00.000Z'),
        {
          ...sample(elsewhere.id, imei, '2026-10-18T07:00:00.000Z'),
          tenantId: otherTenant,
        },
      ],
    });
    const reported = 'query($id:ID!){fleetDevice(id:$id){vehicleId lastReportedAt}}';
    expect(await query(reported, { id: device.id }, branchId)).toEqual({
      data: { fleetDevice: { vehicleId: first.id, lastReportedAt: '2026-10-18T06:00:00.000Z' } },
    });
    expect(
      await query(
        'mutation($id:ID!,$vehicleId:ID!){updateFleetDevice(id:$id,input:{vehicleId:$vehicleId}){vehicleId lastReportedAt}}',
        { id: device.id, vehicleId: second.id },
        branchId,
      ),
    ).toEqual({ data: { updateFleetDevice: { vehicleId: second.id, lastReportedAt: null } } });
    await database.client.vehicleStatusSample.create({
      data: sample(second.id, imei, '2026-10-18T06:45:00.000Z'),
    });
    expect(
      await query(
        '{fleetDevices(sort:{field:IMEI,direction:ASC}){items{imei lastReportedAt vehicle{licensePlate}}total}}',
        {},
        branchId,
      ),
    ).toEqual({
      data: {
        fleetDevices: {
          items: [
            {
              imei,
              lastReportedAt: '2026-10-18T06:45:00.000Z',
              vehicle: { licensePlate: 'CB 1002 AX' },
            },
          ],
          total: 1,
        },
      },
    });
    expect(await query(remove, { id: device.id }, branchId)).toEqual({
      data: { deleteFleetDevice: { id: device.id } },
    });
    expect(
      await database.client.vehicleStatusSample.count({
        where: { tenantId, branchId, deviceImei: imei },
      }),
    ).toBe(3);
  });
});
