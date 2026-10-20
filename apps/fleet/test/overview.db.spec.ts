import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

describe('Fleet overview and daily distance with PostgreSQL', () => {
  const tenantId = randomUUID(),
    branchId = randomUUID();
  // The repeated 03:00 hour at the autumn DST transition is still one Sofia calendar day.
  const asOf = new Date('2026-10-25T01:30:00Z');
  const now = new Date('2026-10-26T01:30:00Z');
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  let url = '';
  let vehicleId = '';
  let groupId = '';
  let emptyGroupId = '';
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    const client = database.client;
    const group = await client.vehicleGroup.create({
      data: { tenantId, branchId, name: 'Active group', colorToken: 'C2' },
    });
    groupId = group.id;
    emptyGroupId = (
      await client.vehicleGroup.create({
        data: { tenantId, branchId, name: 'Empty group', colorToken: 'C3' },
      })
    ).id;
    const moving = await client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'AA 001', groupId },
    });
    vehicleId = moving.id;
    const offline = await client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'BB 001', status: 'IN_WORKSHOP' },
    });
    const inactive = await client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'CC 001', status: 'INACTIVE', groupId },
    });
    for (const [vehicle, imei, recordedAt] of [
      [moving, '000000000000001', asOf],
      [offline, '000000000000002', new Date(asOf.getTime() - 49 * 3600000)],
    ] as const) {
      await client.device.create({ data: { tenantId, branchId, vehicleId: vehicle.id, imei } });
      await client.vehicleStatusSample.create({
        data: {
          tenantId,
          branchId,
          vehicleId: vehicle.id,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt,
          receivedAt: recordedAt,
          ignition: true,
          speedKph: 10,
        },
      });
    }
    await client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId,
        source: 'MANUAL',
        recordedAt: now,
        receivedAt: now,
        odometerKm: 100,
      },
    });
    for (const [startedAt, distanceKm] of [
      ['2026-10-24T22:00:00Z', 10],
      ['2026-10-25T01:00:00Z', 20],
      ['2026-10-24T20:59:59Z', 7],
      ['2026-10-25T01:30:01Z', 500],
      ['2026-10-10T10:00:00Z', 100],
      ['2026-10-25T00:00:00Z', null],
    ] as const) {
      await client.trip.create({
        data: {
          tenantId,
          branchId,
          vehicleId,
          source: 'DEMO',
          startedAt: new Date(startedAt),
          distanceKm,
        },
      });
    }
    for (const vehicle of [moving, inactive]) {
      await client.fleetEvent.create({
        data: {
          tenantId,
          branchId,
          vehicleId: vehicle.id,
          source: 'DEMO',
          occurredAt: asOf,
          kind: 'CRASH_DETECTED',
          severity: 'CRITICAL',
          alertStatus: 'OPEN',
        },
      });
      await client.serviceTask.create({
        data: {
          tenantId,
          branchId,
          vehicleId: vehicle.id,
          serviceType: 'OIL_CHANGE',
          dueOn: new Date('2026-10-24T00:00:00Z'),
        },
      });
    }
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, randomUUID()],
      [randomUUID(), branchId],
    ] as const) {
      const foreign = await client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'Foreign' },
      });
      await client.vehicleStatusSample.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: foreign.id,
          source: 'DEMO',
          deviceImei: '000000000000099',
          recordedAt: new Date('2026-11-15T00:00:00Z'),
          receivedAt: new Date('2026-11-15T00:00:00Z'),
        },
      });
      await client.trip.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: foreign.id,
          source: 'DEMO',
          startedAt: asOf,
          distanceKm: 5000,
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
  async function query(source: string, variables: Record<string, unknown> = {}, scope = branchId) {
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
  it('aggregates scoped clocks, real daily distances, active group buckets and operational counts', async () => {
    const result = await query(
      '{fleetOverview{dataAsOf businessDate activeVehicles movingVehicles notReportingVehicles distanceTodayKm openCriticalAlerts overdueService dailyDistance{date distanceKm} activityByGroup{group{id name colorToken} total moving idle parked notReporting asset noDevice}}}',
    );
    const points = Array.from({ length: 14 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 9, 12 + index)).toISOString().slice(0, 10),
      distanceKm: index === 12 ? 7 : index === 13 ? 30 : 0,
    }));
    expect(result).toEqual({
      data: {
        fleetOverview: {
          dataAsOf: asOf.toISOString(),
          businessDate: '2026-10-26',
          activeVehicles: 1,
          movingVehicles: 1,
          notReportingVehicles: 1,
          distanceTodayKm: 30,
          openCriticalAlerts: 2,
          overdueService: 1,
          dailyDistance: points,
          activityByGroup: [
            {
              group: { id: groupId, name: 'Active group', colorToken: 'C2' },
              total: 1,
              moving: 1,
              idle: 0,
              parked: 0,
              notReporting: 0,
              asset: 0,
              noDevice: 0,
            },
            {
              group: { id: emptyGroupId, name: 'Empty group', colorToken: 'C3' },
              total: 0,
              moving: 0,
              idle: 0,
              parked: 0,
              notReporting: 0,
              asset: 0,
              noDevice: 0,
            },
            {
              group: null,
              total: 1,
              moving: 0,
              idle: 0,
              parked: 0,
              notReporting: 1,
              asset: 0,
              noDevice: 0,
            },
          ],
        },
      },
    });
  });
  it('returns a bounded complete vehicle series and rejects foreign IDs', async () => {
    const source =
      'query($vehicleId:ID,$days:Int!){fleetDailyDistance(vehicleId:$vehicleId,days:$days){dataAsOf points{date distanceKm}}}';
    expect(await query(source, { vehicleId, days: 2 })).toEqual({
      data: {
        fleetDailyDistance: {
          dataAsOf: asOf.toISOString(),
          points: [
            { date: '2026-10-24', distanceKm: 7 },
            { date: '2026-10-25', distanceKm: 30 },
          ],
        },
      },
    });
    expect(await query(source, { vehicleId: randomUUID(), days: 2 })).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    for (const days of [0, 94]) {
      expect(await query(source, { vehicleId, days })).toMatchObject({
        errors: [{ extensions: { fieldErrors: [{ path: 'days' }] } }],
      });
    }
    const emptyBranch = randomUUID();
    expect(await query(source, { days: 14 }, emptyBranch)).toEqual({
      data: { fleetDailyDistance: { dataAsOf: null, points: [] } },
    });
    expect(
      await query(
        '{fleetOverview{dataAsOf activeVehicles distanceTodayKm dailyDistance{date} openCriticalAlerts overdueService}}',
        {},
        emptyBranch,
      ),
    ).toEqual({
      data: {
        fleetOverview: {
          dataAsOf: null,
          activeVehicles: 0,
          distanceTodayKm: 0,
          dailyDistance: [],
          openCriticalAlerts: 0,
          overdueService: 0,
        },
      },
    });
  });
});
