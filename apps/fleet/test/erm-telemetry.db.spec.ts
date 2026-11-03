import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import type { ErmTelemetryEvent } from '../src/integrations/erm/erm-telemetry.client.js';
import { ErmTelemetryJobs } from '../src/modules/erm-telemetry/erm-telemetry.jobs.js';
import { createTestDatabase } from './test-database.js';

const installedAt = new Date('2026-11-03T12:00:00.000Z');
const at = (seconds: number) => new Date(installedAt.getTime() + seconds * 1000);
const scopeA = { tenantId: randomUUID(), branchId: randomUUID() };
const scopeB = { tenantId: randomUUID(), branchId: randomUUID() };
type FeedEvent = Omit<
  ErmTelemetryEvent,
  'id' | 'eventTime' | 'receivedAt' | 'ignitionOn' | 'edata'
> & {
  id: string;
  eventTime: string | null;
  receivedAt: string;
  ignitionOn?: boolean | null;
  edata?: unknown;
};

function event(id: string, seconds: number, engineOn: boolean | null): FeedEvent {
  return {
    id,
    eventId: null,
    eventTime: at(seconds).toISOString(),
    receivedAt: at(seconds + 10).toISOString(),
    latitude: 42,
    longitude: 23,
    speedKmh: 0,
    heading: 360,
    odometerKm: 100,
    mainVoltage: 24,
    backupVoltage: 4,
    engineOn,
  };
}

describe('ERM telemetry import with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let feed: Server | undefined;
  let jobs: ErmTelemetryJobs;
  let url = '';
  const token = randomBytes(24).toString('hex');
  const events = new Map<string, ReturnType<typeof event>[]>();
  const failures = new Map<string, 'invalid' | 500>();
  const originalEnvironment = Object.fromEntries(
    [
      'FLEET_ENABLED',
      'FLEET_ERM_TELEMETRY_ENABLED',
      'ERM_TELEMETRY_URL',
      'ERM_TELEMETRY_TOKEN',
    ].map((key) => [key, process.env[key]]),
  );

  beforeAll(async () => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401).end('{}');
        return;
      }
      const requested = new URL(request.url ?? '/', 'http://127.0.0.1');
      const imei = /^\/internal\/telemetry\/units\/(\d{15})\/events$/.exec(requested.pathname)?.[1];
      const after = requested.searchParams.get('after') ?? '';
      const limit = Number(requested.searchParams.get('limit'));
      if (
        request.method !== 'GET' ||
        !imei ||
        !/^\d+$/.test(after) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 500
      ) {
        response.writeHead(400).end('{}');
        return;
      }
      const failure = failures.get(imei);
      if (failure === 500) {
        response.writeHead(500).end('{}');
      } else if (failure === 'invalid') {
        response.end(JSON.stringify({ events: [{ id: 'invalid' }], next: '21' }));
      } else {
        const page = (events.get(imei) ?? [])
          .filter((entry) => BigInt(entry.id) > BigInt(after))
          .slice(0, limit);
        response.end(JSON.stringify({ events: page, next: page.at(-1)?.id ?? after }));
      }
    });
    feed = server;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Missing telemetry stub address.');
    }
    process.env.FLEET_ENABLED = 'true';
    process.env.FLEET_ERM_TELEMETRY_ENABLED = 'true';
    process.env.ERM_TELEMETRY_URL = `http://127.0.0.1:${String(address.port)}`;
    process.env.ERM_TELEMETRY_TOKEN = token;
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
    jobs = module.get(ErmTelemetryJobs);
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    for (const cron of module.get(SchedulerRegistry).getCronJobs().values()) {
      await cron.stop();
    }
    url = `${await app.getUrl()}/graphql`;
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await closeDatabase?.();
      } finally {
        try {
          if (feed) {
            await new Promise<void>((resolve, reject) => {
              feed?.close((error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              });
            });
          }
        } finally {
          for (const [key, value] of Object.entries(originalEnvironment)) {
            if (value === undefined) {
              Reflect.deleteProperty(process.env, key);
            } else {
              process.env[key] = value;
            }
          }
        }
      }
    }
  });

  async function trips(selectedScope: typeof scopeA, vehicleId: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}`,
        'x-branch-id': selectedScope.branchId,
      },
      body: JSON.stringify({
        query:
          'query($vehicleId:ID!){fleetTrips(filter:{vehicleIds:[$vehicleId]}){total items{source vehicleId}}}',
        variables: { vehicleId },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('imports scoped samples, eData events and ignition trips once, retaining cursors on failed pages and ignoring late samples for trips', async () => {
    const vehicleA = await database.client.vehicle.create({
      data: { ...scopeA, licensePlate: 'ERM A' },
    });
    const vehicleB = await database.client.vehicle.create({
      data: { ...scopeB, licensePlate: 'ERM B' },
    });
    const deviceA = await database.client.device.create({
      data: {
        ...scopeA,
        imei: '000000000000101',
        vehicleId: vehicleA.id,
        installedAt,
        createdAt: at(-3600),
      },
    });
    const stock = await database.client.device.create({
      data: { ...scopeA, imei: '000000000000102', createdAt: installedAt },
    });
    const deviceB = await database.client.device.create({
      data: {
        ...scopeB,
        imei: '000000000000103',
        vehicleId: vehicleB.id,
        createdAt: installedAt,
      },
    });
    const faultReport = {
      report: '419',
      faults: [
        { spn: 4339, fmi: 7, status: 'ADDED' },
        { spn: 1247, fmi: 11, status: 'DELETED' },
      ],
    };
    const diagnostics = {
      report: '411',
      can: true,
      j1708: false,
      obd: false,
      obdMask: 0,
      canError: true,
      ignition: 2,
    };
    events.set(deviceA.imei, [
      { ...event('1', -20, true), receivedAt: at(-1).toISOString(), edata: faultReport },
      { ...event('2', 0, null), ignitionOn: true },
      {
        ...event('3', 0, false),
        eventId: '33',
        speedKmh: 399,
        odometerKm: 999,
        edata: faultReport,
      },
      {
        ...event('4', 60, true),
        speedKmh: 96.5,
        heading: 123.6,
        odometerKm: 101,
        edata: { ...diagnostics, canError: false },
      },
      { ...event('5', 300, false), receivedAt: at(120).toISOString(), edata: faultReport },
      { ...event('6', 180, true), ignitionOn: false, speedKmh: 5, odometerKm: 110 },
      { ...event('7', 240, true), speedKmh: 401, odometerKm: 111 },
      {
        ...event('8', 300, null),
        latitude: 91,
        speedKmh: 15,
        heading: -1,
        odometerKm: 10_000_001,
        mainVoltage: 60.01,
        backupVoltage: 10.01,
        edata: diagnostics,
      },
      { ...event('9', 360, false), eventTime: null, edata: faultReport },
      { ...event('11', 300, null), edata: { report: '999', faults: 'ignored' } },
    ]);
    events.set(stock.imei, [{ ...event('10', 30, true), edata: faultReport }]);
    events.set(deviceB.imei, [
      { ...event('19', -20, true), receivedAt: at(-1).toISOString() },
      { ...event('20', 60, true), odometerKm: 500 },
    ]);

    await jobs.tick();
    const samples = await database.client.vehicleStatusSample.findMany({
      where: scopeA,
      orderBy: { recordedAt: 'asc' },
    });
    expect(samples).toMatchObject(
      [
        { recordedAt: at(0), ignition: true, speedKph: 0, odometerKm: 100, headingDeg: 0 },
        {
          recordedAt: at(60),
          ignition: true,
          speedKph: 96.5,
          odometerKm: 101,
          headingDeg: 124,
        },
        { recordedAt: at(180), ignition: false, speedKph: 5, odometerKm: 110 },
        { recordedAt: at(240), ignition: true, speedKph: null, odometerKm: 111 },
        {
          recordedAt: at(300),
          ignition: null,
          latitude: null,
          longitude: null,
          speedKph: 15,
          headingDeg: null,
          odometerKm: null,
          externalVoltage: null,
          backupBatteryVoltage: null,
        },
      ].map((sample) => ({
        ...scopeA,
        source: 'ERM',
        deviceImei: deviceA.imei,
        vehicleId: vehicleA.id,
        address: null,
        fuelLevelPct: null,
        engineHours: null,
        coolantTempC: null,
        ...sample,
      })),
    );
    expect(samples[0]).toMatchObject({
      receivedAt: at(10),
      latitude: 42,
      longitude: 23,
      externalVoltage: 24,
      backupBatteryVoltage: 4,
    });
    const tripRows = () =>
      database.client.trip.findMany({ where: scopeA, orderBy: { startedAt: 'asc' } });
    const initialTrips = await tripRows();
    expect(initialTrips).toMatchObject(
      [
        {
          startedAt: at(0),
          endedAt: at(180),
          startLatitude: 42,
          startLongitude: 23,
          endLatitude: 42,
          endLongitude: 23,
          startOdometerKm: 100,
          endOdometerKm: 110,
          distanceKm: 10,
          maxSpeedKph: 96.5,
        },
        {
          startedAt: at(240),
          endedAt: null,
          startOdometerKm: 111,
          endOdometerKm: null,
          distanceKm: null,
          maxSpeedKph: 15,
        },
      ].map((trip) => ({
        ...scopeA,
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        source: 'ERM',
        driverId: null,
        startAddress: null,
        endAddress: null,
        idleSeconds: null,
        fuelUsedL: null,
        drivingScore: null,
        ecoScore: null,
        ...trip,
      })),
    );
    expect(await database.client.vehicleStatusSample.findMany({ where: scopeB })).toMatchObject([
      { ...scopeB, vehicleId: vehicleB.id, deviceImei: deviceB.imei, source: 'ERM' },
    ]);
    expect(await database.client.trip.findMany({ where: scopeB })).toMatchObject([
      { ...scopeB, vehicleId: vehicleB.id, deviceImei: deviceB.imei, source: 'ERM', endedAt: null },
    ]);
    for (const [device, lastEventId] of [
      [deviceA, 11n],
      [stock, 10n],
      [deviceB, 20n],
    ] as const) {
      expect(
        await database.client.fleetErmCursor.findUniqueOrThrow({ where: { deviceId: device.id } }),
      ).toMatchObject({
        tenantId: device.tenantId,
        branchId: device.branchId,
        deviceId: device.id,
        lastEventId,
      });
    }
    expect(
      await database.client.vehicleStatusSample.count({ where: { deviceImei: stock.imei } }),
    ).toBe(0);
    const fleetEvents = () =>
      database.client.fleetEvent.findMany({
        where: scopeA,
        orderBy: [{ occurredAt: 'asc' }, { troubleCode: 'asc' }],
      });
    const initialEvents = await fleetEvents();
    expect(initialEvents).toMatchObject(
      [
        {
          occurredAt: at(0),
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'INFO',
          troubleCode: 'SPN 1247 FMI 11',
          details: 'eData 419: the fault logger deleted this fault; this does not prove a repair.',
          latitude: 42,
          longitude: 23,
          speedKph: 399,
        },
        {
          occurredAt: at(0),
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'WARNING',
          troubleCode: 'SPN 4339 FMI 7',
          details: 'eData 419: the fault logger added this fault.',
          latitude: 42,
          longitude: 23,
          speedKph: 399,
        },
        {
          occurredAt: at(300),
          kind: 'CAN_ERROR',
          severity: 'WARNING',
          troubleCode: null,
          details:
            'eData 411 reported the CAN error flag; CAN=1, J1708=0, OBD=0, OBD mask=0, ignition=2.',
          latitude: null,
          longitude: null,
          speedKph: 15,
        },
      ].map((entry) => ({
        ...scopeA,
        source: 'ERM',
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        tripId: null,
        driverId: null,
        intensity: null,
        address: null,
        measuredValue: null,
        thresholdValue: null,
        alertStatus: null,
        acknowledgedAt: null,
        resolvedAt: null,
        remark: null,
        ...entry,
      })),
    );
    expect(await database.client.fleetEvent.count()).toBe(3);
    expect(await trips(scopeA, vehicleA.id)).toEqual({
      data: {
        fleetTrips: {
          total: 2,
          items: [
            { source: 'ERM', vehicleId: vehicleA.id },
            { source: 'ERM', vehicleId: vehicleA.id },
          ],
        },
      },
    });
    for (const selectedScope of [scopeA, { ...scopeA, branchId: scopeB.branchId }]) {
      expect(await trips(selectedScope, vehicleB.id)).toEqual({
        data: { fleetTrips: { total: 0, items: [] } },
      });
    }

    await jobs.tick();
    expect(await database.client.vehicleStatusSample.count()).toBe(6);
    expect(await tripRows()).toEqual(initialTrips);
    expect(await fleetEvents()).toEqual(initialEvents);
    await database.client.fleetErmCursor.update({
      where: { ...scopeA, deviceId: deviceA.id },
      data: { lastEventId: 0n },
    });
    await jobs.tick();
    expect(await database.client.vehicleStatusSample.count()).toBe(6);
    expect(await tripRows()).toEqual(initialTrips);
    expect(await fleetEvents()).toEqual(initialEvents);
    events.get(deviceA.imei)?.push({
      ...event('21', 120, false),
      receivedAt: at(420).toISOString(),
      odometerKm: 102,
    });
    await jobs.tick();
    expect(await database.client.vehicleStatusSample.count()).toBe(7);
    expect(await tripRows()).toEqual(initialTrips);

    failures.set(deviceA.imei, 500);
    failures.set(deviceB.imei, 'invalid');
    events.get(stock.imei)?.push(event('22', 420, null));
    await jobs.tick();
    for (const [device, lastEventId] of [
      [deviceA, 21n],
      [stock, 22n],
      [deviceB, 20n],
    ] as const) {
      expect(
        await database.client.fleetErmCursor.findUniqueOrThrow({ where: { deviceId: device.id } }),
      ).toMatchObject({ lastEventId });
    }
    expect(await database.client.vehicleStatusSample.count()).toBe(7);
    expect(await tripRows()).toEqual(initialTrips);
  });
});
