import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const list = `query($filter:FleetVehicleFilter,$sort:FleetVehicleSort,$offset:Int!,$limit:Int!,$search:String){
  fleetVehicles(filter:$filter,sort:$sort,offset:$offset,limit:$limit,search:$search){items{licensePlate}total}}`;
const summary = `query{fleetVehicleSummary{dataAsOf inOperation inWorkshop moving notReporting openAlerts lowFuel}}`;

describe('Vehicles Storybook list contract with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication | undefined;
  let url: string;
  let closeDatabase: (() => Promise<void>) | undefined;
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
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function expectPage(
    branchId: string,
    variables: Record<string, unknown>,
    plates: string[],
    total = plates.length,
  ) {
    expect(
      await query(
        list,
        { offset: 0, limit: 20, sort: { field: 'LICENSE_PLATE', direction: 'ASC' }, ...variables },
        branchId,
      ),
    ).toEqual({
      data: { fleetVehicles: { items: plates.map((licensePlate) => ({ licensePlate })), total } },
    });
  }

  it('filters and sorts derived values before paging, keeps clock boundaries and exact whole-Branch counts', async () => {
    const branchId = randomUUID();
    const now = new Date('2026-10-18T12:00:00.000Z');
    const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
    const rows = await Promise.all(
      [
        { licensePlate: 'A moving' },
        { licensePlate: 'B idle', status: 'IN_WORKSHOP' as const },
        { licensePlate: 'C parked' },
        { licensePlate: 'D asset', status: 'INACTIVE' as const },
        { licensePlate: 'E silent' },
        { licensePlate: 'F disconnected' },
        { licensePlate: 'G no device' },
      ].map((data) => database.client.vehicle.create({ data: { tenantId, branchId, ...data } })),
    );
    const [moving, idle, parked, asset, silent, disconnected, noDevice] = rows;
    if (!moving || !idle || !parked || !asset || !silent || !disconnected || !noDevice) {
      throw new Error('Missing fixture vehicles.');
    }
    for (const [index, vehicle] of rows.entries()) {
      if (vehicle.id !== noDevice.id) {
        await database.client.device.create({
          data: {
            tenantId,
            branchId,
            vehicleId: vehicle.id,
            imei: `12345678901230${String(index)}`,
          },
        });
      }
    }
    const samples = [
      {
        vehicleId: moving.id,
        recordedAt: now,
        ignition: true,
        speedKph: 5,
        fuelLevelPct: 11.9,
        odometerKm: 100,
      },
      {
        vehicleId: idle.id,
        recordedAt: at(-6),
        ignition: true,
        speedKph: 4.9,
        fuelLevelPct: 12,
        odometerKm: 200,
      },
      {
        vehicleId: parked.id,
        recordedAt: at(-48),
        ignition: false,
        fuelLevelPct: 1,
        odometerKm: 300,
      },
      { vehicleId: asset.id, recordedAt: at(-0.1), ignition: null, fuelLevelPct: 8 },
      {
        vehicleId: disconnected.id,
        recordedAt: new Date(at(-48).getTime() - 1),
        ignition: true,
        speedKph: 80,
      },
      { vehicleId: noDevice.id, recordedAt: at(-96), ignition: true, speedKph: 90 },
    ];
    for (const sample of samples) {
      await database.client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          source: 'DEMO',
          deviceImei: '123456789099999',
          receivedAt: sample.recordedAt,
          ...sample,
        },
      });
    }
    // A later MANUAL reading controls the odometer but never activity, last report or data clock.
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: parked.id,
        source: 'MANUAL',
        deviceImei: null,
        recordedAt: at(2),
        receivedAt: at(2),
        odometerKm: 500,
      },
    });
    await database.client.fleetEvent.createMany({
      data: [moving, moving, parked].map((vehicle) => ({
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        source: 'DEMO' as const,
        occurredAt: now,
        kind: 'LOW_FUEL' as const,
        severity: 'WARNING' as const,
        alertStatus: 'OPEN' as const,
      })),
    });
    // Neither another Tenant in this Branch nor another Branch can move this clock/counts.
    for (const other of [
      { tenantId: randomUUID(), branchId },
      { tenantId, branchId: randomUUID() },
    ]) {
      const vehicle = await database.client.vehicle.create({
        data: { ...other, licensePlate: 'FOREIGN' },
      });
      await database.client.vehicleStatusSample.create({
        data: {
          ...other,
          vehicleId: vehicle.id,
          source: 'DEMO',
          deviceImei: '123456789099998',
          recordedAt: at(24),
          receivedAt: at(24),
        },
      });
    }
    await expectPage(branchId, { filter: { allOf: [{ activities: ['MOVING', 'PARKED'] }] } }, [
      'A moving',
      'C parked',
    ]);
    await expectPage(branchId, { filter: { allOf: [{ activities: ['NOT_CONNECTED'] }] } }, [
      'E silent',
      'F disconnected',
    ]);
    await expectPage(branchId, { filter: { allOf: [{ activities: ['ASSET'] }] } }, ['D asset']);
    await expectPage(branchId, { filter: { allOf: [{ activities: ['NO_DEVICE'] }] } }, [
      'G no device',
    ]);
    await expectPage(
      branchId,
      { filter: { allOf: [{ excludedActivities: ['MOVING', 'NO_DEVICE', 'NOT_CONNECTED'] }] } },
      ['B idle', 'C parked', 'D asset'],
    );
    await expectPage(
      branchId,
      { sort: { field: 'ODOMETER_KM', direction: 'DESC' }, limit: 1 },
      ['C parked'],
      7,
    );
    await expectPage(
      branchId,
      { sort: { field: 'ODOMETER_KM', direction: 'ASC' }, offset: 1, limit: 1 },
      ['B idle'],
      7,
    );
    await expectPage(
      branchId,
      { sort: { field: 'LAST_REPORTED_AT', direction: 'DESC' }, limit: 1 },
      ['A moving'],
      7,
    );
    await expectPage(
      branchId,
      { sort: { field: 'LAST_REPORTED_AT', direction: 'ASC' }, limit: 1 },
      ['G no device'],
      7,
    );
    await expectPage(
      branchId,
      { sort: { field: 'LAST_REPORTED_AT', direction: 'DESC' }, offset: 6, limit: 1 },
      ['E silent'],
      7,
    );
    await expectPage(
      branchId,
      { sort: { field: 'STATUS', direction: 'DESC' }, limit: 1 },
      ['D asset'],
      7,
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ odometerKmAbove: 100 }, { odometerKmBelow: 500 }] } },
      ['B idle'],
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ odometerKmFrom: 100, odometerKmTo: 500 }] } },
      ['A moving', 'B idle', 'C parked'],
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ activities: ['MOVING'] }, { activities: ['PARKED'] }] } },
      [],
    );
    await expectPage(
      branchId,
      { offset: 99, limit: 1, filter: { allOf: [{ activities: ['MOVING'] }] } },
      [],
      1,
    );
    expect(await query(summary, {}, branchId)).toEqual({
      data: {
        fleetVehicleSummary: {
          dataAsOf: now.toISOString(),
          inOperation: 6,
          inWorkshop: 1,
          moving: 1,
          notReporting: 2,
          openAlerts: 3,
          lowFuel: 2,
        },
      },
    });
    expect(await query(summary, {}, randomUUID())).toEqual({
      data: {
        fleetVehicleSummary: {
          dataAsOf: null,
          inOperation: 0,
          inWorkshop: 0,
          moving: 0,
          notReporting: 0,
          openAlerts: 0,
          lowFuel: 0,
        },
      },
    });
  });

  it('keeps filtered state, odometer and alerts from selection when reports and alerts change before response mapping', async () => {
    if (!app) {
      throw new Error('Missing Fleet application.');
    }
    const branchId = randomUUID();
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'SNAPSHOT' },
    });
    const imei = '000000000000041';
    await database.client.device.create({
      data: { tenantId, branchId, vehicleId: vehicle.id, imei },
    });
    const recordedAt = new Date('2026-10-18T06:00:00.000Z');
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        deviceImei: imei,
        recordedAt,
        receivedAt: recordedAt,
        source: 'DEMO',
        ignition: true,
        speedKph: 60,
        odometerKm: 100,
        fuelLevelPct: 8,
        latitude: 42.1,
        longitude: 23.3,
      },
    });
    const alert = await database.client.fleetEvent.create({
      data: {
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        source: 'DEMO',
        occurredAt: recordedAt,
        kind: 'LOW_FUEL',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      },
    });
    const repository = app.get(VehiclesRepository);
    const originalList = repository.list.bind(repository);
    const freshReport = new Date(recordedAt.getTime() + 60_000);
    const manualAt = new Date(recordedAt.getTime() + 120_000);
    const selected = jest
      .spyOn(repository, 'list')
      .mockImplementationOnce(async (scope, page, criteria, sort) => {
        const result = await originalList(scope, page, criteria, sort);
        await database.client.$transaction([
          database.client.vehicleStatusSample.create({
            data: {
              tenantId,
              branchId,
              vehicleId: vehicle.id,
              deviceImei: imei,
              recordedAt: freshReport,
              receivedAt: freshReport,
              source: 'DEMO',
              ignition: false,
              speedKph: 0,
              odometerKm: 150,
              fuelLevelPct: 50,
              latitude: 43.2,
              longitude: 24.4,
            },
          }),
          database.client.vehicleStatusSample.create({
            data: {
              tenantId,
              branchId,
              vehicleId: vehicle.id,
              deviceImei: null,
              recordedAt: manualAt,
              receivedAt: manualAt,
              source: 'MANUAL',
              odometerKm: 250,
            },
          }),
          database.client.fleetEvent.update({
            where: { id: alert.id, tenantId, branchId },
            data: { alertStatus: 'RESOLVED', resolvedAt: freshReport },
          }),
        ]);
        return result;
      });
    const source = `query($filter:FleetVehicleFilter){
      fleetVehicles(filter:$filter,sort:{field:LAST_REPORTED_AT,direction:DESC}){
        total items{id openAlertCount state{
          activity lastReportedAt odometerKm odometerRecordedAt odometerSource fuelStatus latitude
        }}
      }
    }`;
    const filter = {
      allOf: [{ activities: ['MOVING'] }, { odometerKmBelow: 200 }, { hasOpenAlerts: true }],
    };
    try {
      expect(await query(source, { filter }, branchId)).toEqual({
        data: {
          fleetVehicles: {
            total: 1,
            items: [
              {
                id: vehicle.id,
                openAlertCount: 1,
                state: {
                  activity: 'MOVING',
                  lastReportedAt: recordedAt.toISOString(),
                  odometerKm: 100,
                  odometerRecordedAt: recordedAt.toISOString(),
                  odometerSource: 'DEMO',
                  fuelStatus: 'LOW',
                  latitude: 42.1,
                },
              },
            ],
          },
        },
      });
      expect(await query(source, { filter }, branchId)).toEqual({
        data: { fleetVehicles: { total: 0, items: [] } },
      });
      expect(await query(source, {}, branchId)).toEqual({
        data: {
          fleetVehicles: {
            total: 1,
            items: [
              {
                id: vehicle.id,
                openAlertCount: 0,
                state: {
                  activity: 'PARKED',
                  lastReportedAt: freshReport.toISOString(),
                  odometerKm: 250,
                  odometerRecordedAt: manualAt.toISOString(),
                  odometerSource: 'MANUAL',
                  fuelStatus: 'NORMAL',
                  latitude: 43.2,
                },
              },
            ],
          },
        },
      });
    } finally {
      selected.mockRestore();
    }
  });

  it('keeps repeated stored filters, null exclusions, literal text and Sofia date semantics', async () => {
    const branchId = randomUUID();
    const group = await database.client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'North' },
    });
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'Nikolay', lastName: 'Petrov' },
    });
    await database.client.vehicle.createMany({
      data: [
        {
          tenantId,
          branchId,
          licensePlate: 'A',
          make: 'Volvo %_\\',
          modelYear: 2021,
          vehicleType: 'TRACTOR',
          fuelType: 'DIESEL',
          groupId: group.id,
          currentDriverId: driver.id,
          notes: 'Delivery cabin',
          createdAt: new Date('2026-10-17T22:30:00Z'),
        },
        {
          tenantId,
          branchId,
          licensePlate: 'B',
          make: 'VOLVO',
          modelYear: 2024,
          vehicleType: 'VAN',
          createdAt: new Date('2026-10-17T20:30:00Z'),
        },
        {
          tenantId,
          branchId,
          licensePlate: 'C',
          status: 'INACTIVE',
          modelYear: 2020,
          createdAt: new Date('2026-10-18T12:00:00Z'),
        },
      ],
    });
    await expectPage(branchId, { filter: { allOf: [{ makeContains: '%_\\' }] } }, ['A']);
    await expectPage(branchId, { filter: { allOf: [{ makeEquals: 'volvo' }] } }, ['B']);
    await expectPage(branchId, { filter: { allOf: [{ excludedVehicleTypes: ['TRACTOR'] }] } }, [
      'B',
      'C',
    ]);
    await expectPage(branchId, { filter: { allOf: [{ excludedGroupIds: [group.id] }] } }, [
      'B',
      'C',
    ]);
    await expectPage(
      branchId,
      {
        filter: {
          allOf: [
            { excludedStatuses: ['INACTIVE'] },
            { modelYearAbove: 2020 },
            { modelYearBelow: 2024 },
          ],
        },
      },
      ['A'],
    );
    await expectPage(branchId, { filter: { allOf: [{ modelYearEquals: 2024 }] } }, ['B']);
    await expectPage(
      branchId,
      { filter: { allOf: [{ modelYearFrom: 2020, modelYearTo: 2021 }] } },
      ['A', 'C'],
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ createdOnAfter: '2026-10-17' }, { createdOnBefore: '2026-10-19' }] } },
      ['A', 'C'],
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ createdOnFrom: '2026-10-17', createdOnTo: '2026-10-17' }] } },
      ['B'],
    );
    await expectPage(
      branchId,
      {
        filter: {
          allOf: [{ hasGroup: true }, { currentDriverIds: [driver.id] }, { fuelTypes: ['DIESEL'] }],
        },
      },
      ['A'],
    );
    await expectPage(
      branchId,
      { filter: { allOf: [{ groupIds: [group.id] }, { hasDriver: true }] } },
      ['A'],
    );
    await expectPage(branchId, { search: 'Nikolay Delivery' }, ['A']);
  });

  it('returns per-record batch failures, keeps foreign records private and retries failed IDs', async () => {
    const branchId = randomUUID();
    const owned = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'A' },
    });
    const blocked = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'B' },
    });
    const foreign = await database.client.vehicle.create({
      data: { tenantId: randomUUID(), branchId, licensePlate: 'PRIVATE' },
    });
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: blocked.id, imei: '012345678901234' },
    });
    const removeMany =
      'mutation($ids:[ID!]!){deleteFleetVehicles(ids:$ids){succeededIds failures{id code message}}}';
    expect(await query(removeMany, { ids: [blocked.id, owned.id, foreign.id] }, branchId)).toEqual({
      data: {
        deleteFleetVehicles: {
          succeededIds: [owned.id],
          failures: [
            {
              id: blocked.id,
              code: 'CONFLICT',
              message: 'Vehicle has devices or history; deactivate it instead.',
            },
            { id: foreign.id, code: 'NOT_FOUND', message: 'Vehicle not found' },
          ],
        },
      },
    });
    expect(await database.client.vehicle.findUnique({ where: { id: foreign.id } })).not.toBeNull();
    await database.client.device.delete({ where: { id: device.id } });
    expect(await query(removeMany, { ids: [blocked.id] }, branchId)).toEqual({
      data: {
        deleteFleetVehicles: { succeededIds: [blocked.id], failures: [] },
      },
    });
    const deactivateMany =
      'mutation($ids:[ID!]!){deactivateFleetVehicles(ids:$ids){succeededIds failures{id code message}}}';
    const driver = await database.client.driver.create({
      data: { tenantId, branchId, firstName: 'A', lastName: 'B' },
    });
    const active = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'C', currentDriverId: driver.id },
    });
    expect(await query(deactivateMany, { ids: [active.id, foreign.id] }, branchId)).toEqual({
      data: {
        deactivateFleetVehicles: {
          succeededIds: [active.id],
          failures: [{ id: foreign.id, code: 'NOT_FOUND', message: 'Vehicle not found' }],
        },
      },
    });
    expect(await database.client.vehicle.findUnique({ where: { id: active.id } })).toMatchObject({
      status: 'INACTIVE',
      currentDriverId: null,
    });
    for (const ids of [
      [],
      [active.id, active.id],
      Array.from({ length: 101 }, () => randomUUID()),
    ]) {
      expect(await query(removeMany, { ids }, branchId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'ids' }] } }],
      });
    }
  });
});
