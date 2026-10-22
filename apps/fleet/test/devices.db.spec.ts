import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
describe('Device GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
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
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(source: string, variables: Record<string, unknown>, branchId: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        'x-branch-id': branchId,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function truck(branchId: string, licensePlate = 'CA1234AB') {
    return database.client.vehicle.create({ data: { tenantId, branchId, licensePlate } });
  }

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
    // Search and ID filters stay inside the scope; the foreign device shares the online IMEI.
    expect(await query(list, { search: online.imei }, branchId)).toMatchObject({
      data: { fleetDevices: { total: 1, items: [{ id: online.id }] } },
    });
    expect(await query(list, { search: '%_' }, branchId)).toMatchObject({
      data: { fleetDevices: { total: 0 } },
    });
    expect(
      await query(
        'query($ids:[ID!]){fleetDevices(ids:$ids){total}}',
        { ids: [foreignDevice.id] },
        branchId,
      ),
    ).toEqual({ data: { fleetDevices: { total: 0 } } });
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

    // lastReportedAt comes only from the current (vehicle, IMEI) pair.
    const pairBranch = randomUUID();
    const first = await truck(pairBranch, 'CB 1001 AX'),
      second = await truck(pairBranch, 'CB 1002 AX');
    const imei = '990601000000001';
    const device = await database.client.device.create({
      data: { tenantId, branchId: pairBranch, vehicleId: first.id, imei },
    });
    const otherTenant = randomUUID();
    const elsewhere = await database.client.vehicle.create({
      data: { tenantId: otherTenant, branchId: pairBranch, licensePlate: 'OTHER' },
    });
    const sample = (vehicleId: string, deviceImei: string, recordedAt: string) => ({
      tenantId,
      branchId: pairBranch,
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
    expect(
      await query(
        'query($id:ID!){fleetDevice(id:$id){vehicleId lastReportedAt}}',
        { id: device.id },
        pairBranch,
      ),
    ).toEqual({
      data: { fleetDevice: { vehicleId: first.id, lastReportedAt: '2026-10-18T06:00:00.000Z' } },
    });
    expect(
      await query(
        'mutation($id:ID!,$vehicleId:ID!){updateFleetDevice(id:$id,input:{vehicleId:$vehicleId}){vehicleId lastReportedAt}}',
        { id: device.id, vehicleId: second.id },
        pairBranch,
      ),
    ).toEqual({ data: { updateFleetDevice: { vehicleId: second.id, lastReportedAt: null } } });
    await database.client.vehicleStatusSample.create({
      data: sample(second.id, imei, '2026-10-18T06:45:00.000Z'),
    });
    expect(
      await query(
        '{fleetDevices(sort:{field:IMEI,direction:ASC}){items{imei lastReportedAt vehicle{licensePlate}}total}}',
        {},
        pairBranch,
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
  });
});
