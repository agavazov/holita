import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ErmDashboardClient } from '../src/integrations/erm/erm-dashboard.client.js';
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
  let ermServer: Server;
  const originalErmUrl = process.env.ERM_TELEMETRY_URL;
  const originalErmToken = process.env.ERM_TELEMETRY_TOKEN;
  const testErmToken = 'overview-test-token-with-at-least-32-characters';
  const telemetryBatches: string[][] = [];
  beforeAll(async () => {
    process.env.ERM_TELEMETRY_TOKEN = testErmToken;
    ermServer = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on('end', () => {
        const payload: unknown = JSON.parse(body);
        if (
          request.headers.authorization !== `Bearer ${testErmToken}` ||
          typeof payload !== 'object' ||
          payload === null ||
          !('query' in payload) ||
          typeof payload.query !== 'string' ||
          !('variables' in payload) ||
          typeof payload.variables !== 'object' ||
          payload.variables === null ||
          !('imeis' in payload.variables) ||
          !Array.isArray(payload.variables.imeis)
        ) {
          response.writeHead(400).end();
          return;
        }
        const imeis = payload.variables.imeis.filter(
          (imei: unknown): imei is string => typeof imei === 'string',
        );
        response.setHeader('content-type', 'application/json');
        if (payload.query.includes('ermFleetTelemetry')) {
          telemetryBatches.push(imeis);
          response.end(
            JSON.stringify({
              data: {
                ermFleetTelemetry: {
                  asOf: now.toISOString(),
                  units: imeis.map((imei) => ({
                    imei,
                    connected: imei !== '000000000000001' && imei !== '100000000000100',
                    reporting: imei.startsWith('1'),
                    lastFrameAt: now.toISOString(),
                    expectedIntervalSeconds: 300,
                  })),
                },
              },
            }),
          );
        } else {
          response.end(
            JSON.stringify({
              data: {
                ermFleetProblems: {
                  asOf: now.toISOString(),
                  totalCount: 0,
                  hasMore: false,
                  items: [],
                  counts: [],
                },
              },
            }),
          );
        }
      });
    });
    await new Promise<void>((resolve) => ermServer.listen(0, '127.0.0.1', resolve));
    const address = ermServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Missing test ERM address');
    }
    process.env.ERM_TELEMETRY_URL = `http://127.0.0.1:${String(address.port)}`;
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
      await new Promise<void>((resolve, reject) =>
        ermServer.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }),
      );
      if (originalErmUrl === undefined) {
        delete process.env.ERM_TELEMETRY_URL;
      } else {
        process.env.ERM_TELEMETRY_URL = originalErmUrl;
      }
      if (originalErmToken === undefined) {
        delete process.env.ERM_TELEMETRY_TOKEN;
      } else {
        process.env.ERM_TELEMETRY_TOKEN = originalErmToken;
      }
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

    // Exercise exact whole-Branch counts and both pages beyond the former first-100 boundary.
    const vehicles = Array.from({ length: 101 }, (_, index) => ({
      id: randomUUID(),
      tenantId,
      branchId,
      licensePlate: `Map ${String(index)}`,
    }));
    await database.client.vehicle.createMany({ data: vehicles });
    await database.client.device.createMany({
      data: vehicles.map((vehicle, index) => ({
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        imei: `100000000000${String(index).padStart(3, '0')}`,
      })),
    });
    await database.client.vehicleStatusSample.createMany({
      data: vehicles.map((vehicle, index) => ({
        tenantId,
        branchId,
        vehicleId: vehicle.id,
        deviceImei: `100000000000${String(index).padStart(3, '0')}`,
        source: 'ERM',
        recordedAt: asOf,
        receivedAt: asOf,
        ignition: false,
        latitude: index < 100 ? 42 : null,
        longitude: index < 100 ? 23 : null,
      })),
    });
    const positionAt = new Date(asOf.getTime() - 300_000);
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId,
        deviceImei: '000000000000001',
        source: 'ERM',
        recordedAt: positionAt,
        receivedAt: positionAt,
        latitude: 41,
        longitude: 24,
        headingDeg: 90,
        speedKph: 35,
      },
    });
    const dashboard = await query(
      `query($from:DateTime!,$to:DateTime!){fleetDashboard(from:$from,to:$to){
      vehicles{asOf dataAsOf liveAsOf total connected reporting live moving parked noDevice}
      devices{total connected reporting live}
      trips{dataAsOf from to total distanceKm distanceKnownTrips}
    }}`,
      { from: '2026-10-24T21:00:00.000Z', to: '2026-10-25T02:00:00.000Z' },
    );
    expect(dashboard).toEqual({
      data: {
        fleetDashboard: {
          vehicles: {
            asOf: now.toISOString(),
            dataAsOf: asOf.toISOString(),
            liveAsOf: now.toISOString(),
            total: 104,
            connected: 101,
            reporting: 101,
            live: 100,
            moving: 1,
            parked: 101,
            noDevice: 1,
          },
          devices: { total: 103, connected: 101, reporting: 101, live: 100 },
          trips: {
            dataAsOf: asOf.toISOString(),
            from: '2026-10-24T21:00:00.000Z',
            to: '2026-10-25T02:00:00.000Z',
            total: 3,
            distanceKm: 30,
            distanceKnownTrips: 2,
          },
        },
      },
    });
    expect(telemetryBatches).toHaveLength(1);
    expect(telemetryBatches[0]).toHaveLength(103);

    const mapQuery = `query($offset:Int!){fleetMap(offset:$offset,limit:100){asOf dataAsOf total withPosition withoutPosition offset limit hasMore items{vehicle{id} position{latitude longitude headingDeg speedKph recordedAt ageSeconds} connected reporting live}}}`;
    const pages: unknown[] = [];
    for (const offset of [0, 100]) {
      const page = await query(mapQuery, { offset });
      expect(page).toMatchObject({
        data: {
          fleetMap: {
            asOf: now.toISOString(),
            dataAsOf: asOf.toISOString(),
            total: 104,
            withPosition: 101,
            withoutPosition: 3,
            offset,
            limit: 100,
            hasMore: offset === 0,
          },
        },
      });
      if (
        typeof page !== 'object' ||
        page === null ||
        !('data' in page) ||
        typeof page.data !== 'object' ||
        page.data === null ||
        !('fleetMap' in page.data) ||
        typeof page.data.fleetMap !== 'object' ||
        page.data.fleetMap === null ||
        !('items' in page.data.fleetMap) ||
        !Array.isArray(page.data.fleetMap.items)
      ) {
        throw new Error('Missing Fleet map page');
      }
      const pageItems: unknown[] = page.data.fleetMap.items;
      pages.push(...pageItems);
    }
    expect(pages).toHaveLength(104);
    expect(pages).toContainEqual({
      vehicle: { id: vehicleId },
      position: {
        latitude: 41,
        longitude: 24,
        headingDeg: 90,
        speedKph: 35,
        recordedAt: positionAt.toISOString(),
        ageSeconds: 86_700,
      },
      connected: false,
      reporting: false,
      live: false,
    });
    expect(await query(mapQuery, { offset: 0 }, randomUUID())).toMatchObject({
      data: { fleetMap: { total: 0, withPosition: 0, withoutPosition: 0, items: [] } },
    });
    // The client itself chunks a complete registry larger than one ERM batch without truncation.
    const complete = await new ErmDashboardClient().telemetry(
      Array.from({ length: 501 }, (_, index) => `200000000000${String(index).padStart(3, '0')}`),
    );
    expect(complete.units).toHaveLength(501);
    expect(telemetryBatches.slice(-2).map((batch) => batch.length)).toEqual([500, 1]);
  });
});
