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
      signal: AbortSignal.timeout(10000),
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
    // The overdue task is the next service; cancelled tasks are no next service.
    await database.client.serviceTask.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId: moving.id,
          serviceType: 'OIL_CHANGE',
          dueOn: new Date('2020-01-01T00:00:00.000Z'),
        },
        {
          tenantId,
          branchId,
          vehicleId: moving.id,
          serviceType: 'TIRES',
          dueOn: new Date('2099-01-01T00:00:00.000Z'),
        },
        { tenantId, branchId, vehicleId: idle.id, serviceType: 'BRAKES', status: 'CANCELLED' },
      ],
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
    // The response state is classified in TypeScript; it must agree with the SQL filters above.
    expect(
      await query(
        '{fleetVehicles(sort:{field:LICENSE_PLATE,direction:ASC}){items{licensePlate openAlertCount state{activity fuelStatus} nextService{serviceType urgency}}}}',
        {},
        branchId,
      ),
    ).toEqual({
      data: {
        fleetVehicles: {
          items: [
            {
              licensePlate: 'A moving',
              openAlertCount: 2,
              state: { activity: 'MOVING', fuelStatus: 'LOW' },
              nextService: { serviceType: 'OIL_CHANGE', urgency: 'OVERDUE' },
            },
            {
              licensePlate: 'B idle',
              openAlertCount: 0,
              state: { activity: 'IDLE', fuelStatus: 'NORMAL' },
              nextService: null,
            },
            {
              licensePlate: 'C parked',
              openAlertCount: 1,
              state: { activity: 'PARKED', fuelStatus: 'STALE' },
              nextService: null,
            },
            {
              licensePlate: 'D asset',
              openAlertCount: 0,
              state: { activity: 'ASSET', fuelStatus: 'LOW' },
              nextService: null,
            },
            {
              licensePlate: 'E silent',
              openAlertCount: 0,
              state: { activity: 'NOT_CONNECTED', fuelStatus: 'NO_DATA' },
              nextService: null,
            },
            {
              licensePlate: 'F disconnected',
              openAlertCount: 0,
              state: { activity: 'NOT_CONNECTED', fuelStatus: 'NO_DATA' },
              nextService: null,
            },
            {
              licensePlate: 'G no device',
              openAlertCount: 0,
              state: { activity: 'NO_DEVICE', fuelStatus: 'NO_DATA' },
              nextService: null,
            },
          ],
        },
      },
    });
    await expectPage(branchId, { filter: { hasOpenAlerts: true } }, ['A moving', 'C parked']);
    await expectPage(branchId, { filter: { hasOpenAlerts: false } }, [
      'B idle',
      'D asset',
      'E silent',
      'F disconnected',
      'G no device',
    ]);
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

    // Rows without a fleet number sort last and tie; the final `id DESC` key orders them.
    const sorted = randomUUID();
    const [higherId = '', lowerId = ''] = [randomUUID(), randomUUID()].sort().reverse();
    for (const row of [
      { licensePlate: 'СА 7712 КН', fleetNumber: 'Т-02' },
      { licensePlate: 'CA7712KH', fleetNumber: 'A-01' },
      { id: higherId, licensePlate: 'CB 1001 AX', fleetNumber: null },
      { licensePlate: 'CB 50%_\\ AX', fleetNumber: 'B-01' },
      { id: lowerId, licensePlate: 'PB 0001 AA', fleetNumber: null },
    ]) {
      await database.client.vehicle.create({ data: { tenantId, branchId: sorted, ...row } });
    }
    for (const other of [
      { tenantId, branchId: randomUUID() },
      { tenantId: randomUUID(), branchId: sorted },
    ]) {
      await database.client.vehicle.create({
        data: { ...other, licensePlate: 'CA7712KH FOREIGN' },
      });
    }
    const fleetNumber = (direction: string) => ({ field: 'FLEET_NUMBER', direction });
    await expectPage(sorted, { sort: fleetNumber('ASC') }, [
      'CA7712KH',
      'CB 50%_\\ AX',
      'СА 7712 КН',
      'CB 1001 AX',
      'PB 0001 AA',
    ]);
    await expectPage(sorted, { sort: fleetNumber('DESC') }, [
      'СА 7712 КН',
      'CB 50%_\\ AX',
      'CA7712KH',
      'CB 1001 AX',
      'PB 0001 AA',
    ]);
    await expectPage(sorted, { sort: fleetNumber('ASC'), offset: 3, limit: 1 }, ['CB 1001 AX'], 5);
    await expectPage(sorted, { sort: fleetNumber('ASC'), offset: 4, limit: 1 }, ['PB 0001 AA'], 5);
    await expectPage(sorted, { search: 'ca 7712' }, ['CA7712KH']);
    await expectPage(sorted, { search: '%_\\' }, ['CB 50%_\\ AX']);
    await expectPage(sorted, { search: '_' }, ['CB 50%_\\ AX']);
  });
});
