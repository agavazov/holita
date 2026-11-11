import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import type { ErmTelemetryEvent } from '../src/integrations/erm/erm-telemetry.client.js';
import { ErmTelemetryJobs } from '../src/modules/erm-telemetry/erm-telemetry.jobs.js';
import type { ErmNotificationItem } from '../src/modules/notifications/erm-notifications.client.js';
import { NotificationsJobs } from '../src/modules/notifications/notifications.jobs.js';
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
type ExportNotification = Omit<ErmNotificationItem, 'occurredAt'> & {
  occurredAt: string;
  target: { kind: 'DEVICE'; id: string };
  recorded: boolean;
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
  let notificationJobs: NotificationsJobs;
  let url = '';
  const token = randomBytes(24).toString('hex');
  const events = new Map<string, ReturnType<typeof event>[]>();
  const failures = new Map<string, 'invalid' | 500>();
  const notifications = new Map<string, { items: ExportNotification[]; next: string }>();
  const notificationFailures = new Map<string, 'invalid' | 500>();
  const notificationRequests = new Map<string, URL>();
  const originalEnvironment = Object.fromEntries(
    [
      'FLEET_ENABLED',
      'FLEET_ERM_TELEMETRY_ENABLED',
      'FLEET_ERM_EDATA_MEASUREMENTS_ENABLED',
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
      const notificationImei = /^\/internal\/notifications\/units\/(\d{15})$/.exec(
        requested.pathname,
      )?.[1];
      if (notificationImei) {
        notificationRequests.set(notificationImei, requested);
        const page = notifications.get(notificationImei) ?? { items: [], next: 'empty' };
        const failure = notificationFailures.get(notificationImei);
        if (failure === 500) {
          response.writeHead(500).end('{}');
        } else {
          const items = requested.searchParams.get('after') === page.next ? [] : page.items;
          response.end(
            JSON.stringify({
              items: failure === 'invalid' ? [...items, { sourceId: 'invalid' }] : items,
              next: page.next,
              hasMore: false,
            }),
          );
        }
        return;
      }
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
    process.env.FLEET_ERM_EDATA_MEASUREMENTS_ENABLED = 'true';
    process.env.ERM_TELEMETRY_URL = `http://127.0.0.1:${String(address.port)}`;
    process.env.ERM_TELEMETRY_TOKEN = token;
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(FleetClock)
      .useValue({ now: () => at(600) })
      .overrideProvider(CoreClient)
      .useValue({
        requireBranch: jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined),
      })
      .compile();
    jobs = module.get(ErmTelemetryJobs);
    notificationJobs = module.get(NotificationsJobs);
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
      data: { ...scopeA, imei: '000000000000102', createdAt: at(-14 * 86_400) },
    });
    const deviceB = await database.client.device.create({
      data: {
        ...scopeB,
        imei: '000000000000103',
        vehicleId: vehicleB.id,
        createdAt: installedAt,
      },
    });
    const catalog = await database.client.edataCatalog.create({
      data: {
        sourceSha256: '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0',
        extractorVersion: '1.0.0',
        schemaVersion: 1,
        packageLabel: 'v9.56',
        contentSha256: 'a'.repeat(64),
        metadata: {},
      },
    });
    await database.client.edataCatalogSource.create({
      data: { catalogId: catalog.id, key: 'monitor', kind: 'monitor', evidence: {} },
    });
    await database.client.edataCatalogParameter.createMany({
      data: [
        { key: 'engine-1', parameterId: 1, name: 'Engine Speed (RPM)', category: '1' },
        { key: 'engine-2', parameterId: 1, name: 'Engine Speed (RPM)', category: '2' },
        {
          key: 'coolant',
          parameterId: 539,
          name: 'Engine Coolant Temperature (c)',
          category: '1',
          multiply: '1.0',
          offset: '-40.0',
        },
      ].map((parameter) => ({
        ...parameter,
        catalogId: catalog.id,
        sourceKey: 'monitor',
        details: {},
      })),
    });
    const edataMeasurements = {
      report: '405',
      measurements: [
        { parameterId: 1, parameterType: 0, valueSize: 2, valueHex: '0aBc' },
        { parameterId: 539, parameterType: 1, valueSize: 1, valueHex: '00' },
        { parameterId: 65000, parameterType: 255, valueSize: 4, valueHex: 'ffffffff' },
      ],
    };
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
      { ...event('1', -20, true), receivedAt: at(-1).toISOString(), edata: edataMeasurements },
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
      { ...event('5', 300, false), receivedAt: at(120).toISOString(), edata: edataMeasurements },
      {
        ...event('6', 180, true),
        ignitionOn: false,
        speedKmh: 5,
        odometerKm: 110,
        edata: edataMeasurements,
      },
      {
        ...event('7', 240, true),
        speedKmh: 401,
        odometerKm: 111,
        edata: {
          report: '405',
          measurements: [{ parameterId: 1, parameterType: 0, valueSize: 2, valueHex: '0000' }],
        },
      },
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
      { ...event('9', 360, false), eventTime: null, edata: edataMeasurements },
      { ...event('11', 300, null), edata: { report: '999', faults: 'ignored' } },
    ]);
    events.set(stock.imei, [{ ...event('10', 30, true), edata: edataMeasurements }]);
    events.set(deviceB.imei, [
      { ...event('19', -20, true), receivedAt: at(-1).toISOString() },
      { ...event('20', 60, true), odometerKm: 500, edata: edataMeasurements },
    ]);

    await jobs.tick();
    const measurementRows = () =>
      database.client.vehicleEdataMeasurement.findMany({
        where: scopeA,
        orderBy: [{ parameterId: 'asc' }, { recordedAt: 'asc' }],
      });
    const importedMeasurements = await measurementRows();
    expect(importedMeasurements).toMatchObject([
      {
        ...scopeA,
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        source: 'ERM',
        sourceEventId: 6n,
        recordedAt: at(180),
        receivedAt: at(190),
        parameterId: 1,
        parameterType: 0,
        valueSize: 2,
        valueHex: '0aBc',
        name: 'Engine Speed (RPM)',
        unit: 'RPM',
      },
      {
        ...scopeA,
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        source: 'ERM',
        sourceEventId: 7n,
        recordedAt: at(240),
        receivedAt: at(250),
        parameterId: 1,
        parameterType: 0,
        valueSize: 2,
        valueHex: '0000',
        name: 'Engine Speed (RPM)',
        unit: 'RPM',
      },
      {
        ...scopeA,
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        source: 'ERM',
        sourceEventId: 6n,
        recordedAt: at(180),
        receivedAt: at(190),
        parameterId: 539,
        parameterType: 1,
        valueSize: 1,
        valueHex: '00',
        name: 'Engine Coolant Temperature (c)',
        unit: 'c',
      },
      {
        ...scopeA,
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        source: 'ERM',
        sourceEventId: 6n,
        recordedAt: at(180),
        receivedAt: at(190),
        parameterId: 65000,
        parameterType: 255,
        valueSize: 4,
        valueHex: 'ffffffff',
        name: null,
        unit: null,
      },
    ]);
    expect(await database.client.vehicleEdataMeasurement.count({ where: scopeB })).toBe(3);
    expect(
      await database.client.vehicleEdataMeasurement.count({ where: { deviceImei: stock.imei } }),
    ).toBe(0);
    async function measurements(selectedScope = scopeA, vehicleId = vehicleA.id) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}`,
          'x-branch-id': selectedScope.branchId,
        },
        body: JSON.stringify({
          query:
            'query($id:ID!,$from:DateTime!,$to:DateTime!){fleetVehicleEdataMeasurements(vehicleId:$id,from:$from,to:$to,parameterIds:[1]){truncated items{recordedAt valueHex name unit}}}',
          variables: { id: vehicleId, from: installedAt.toISOString(), to: at(360).toISOString() },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const body: unknown = await response.json();
      return body;
    }
    expect(await measurements()).toEqual({
      data: {
        fleetVehicleEdataMeasurements: {
          truncated: false,
          items: [
            {
              recordedAt: at(180).toISOString(),
              valueHex: '0aBc',
              name: 'Engine Speed (RPM)',
              unit: 'RPM',
            },
            {
              recordedAt: at(240).toISOString(),
              valueHex: '0000',
              name: 'Engine Speed (RPM)',
              unit: 'RPM',
            },
          ],
        },
      },
    });
    async function latest(selectedScope = scopeA) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}`,
          'x-branch-id': selectedScope.branchId,
        },
        body: JSON.stringify({
          query:
            'query($id:ID!){fleetVehicleEdataLatest(vehicleId:$id){parameterId recordedAt valueHex name value}}',
          variables: { id: vehicleA.id },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const body: unknown = await response.json();
      return body;
    }
    expect(await latest()).toEqual({
      data: {
        fleetVehicleEdataLatest: [
          {
            parameterId: 1,
            recordedAt: at(240).toISOString(),
            valueHex: '0000',
            name: 'Engine Speed (RPM)',
            value: null,
          },
          {
            parameterId: 539,
            recordedAt: at(180).toISOString(),
            valueHex: '00',
            name: 'Engine Coolant Temperature (c)',
            value: -40,
          },
          {
            parameterId: 65000,
            recordedAt: at(180).toISOString(),
            valueHex: 'ffffffff',
            name: null,
            value: null,
          },
        ],
      },
    });
    for (const selectedScope of [scopeB, { ...scopeA, branchId: scopeB.branchId }]) {
      expect(await measurements(selectedScope)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
      expect(await latest(selectedScope)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
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
    for (const [device, lastEventId, lastReceivedAt] of [
      [deviceA, 11n, at(370)],
      [stock, 10n, at(40)],
      [deviceB, 20n, at(70)],
    ] as const) {
      expect(
        await database.client.fleetErmCursor.findUniqueOrThrow({ where: { deviceId: device.id } }),
      ).toMatchObject({
        tenantId: device.tenantId,
        branchId: device.branchId,
        deviceId: device.id,
        lastEventId,
        lastReceivedAt,
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
          receivedAt: at(10),
          sourceEventId: 3n,
          diagnosticReport: 419,
          diagnosticIndex: 1,
          diagnosticStatus: 2,
          diagnosticSpn: 1247n,
          diagnosticFmi: 11,
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
          receivedAt: at(10),
          sourceEventId: 3n,
          diagnosticReport: 419,
          diagnosticIndex: 0,
          diagnosticStatus: 1,
          diagnosticSpn: 4339n,
          diagnosticFmi: 7,
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
          receivedAt: at(310),
          sourceEventId: 8n,
          diagnosticReport: 411,
          diagnosticIndex: 0,
          diagnosticStatus: null,
          diagnosticSpn: null,
          diagnosticFmi: null,
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
    expect(await measurementRows()).toEqual(importedMeasurements);
    await database.client.fleetErmCursor.update({
      where: { ...scopeA, deviceId: deviceA.id },
      data: { lastEventId: 0n },
    });
    await jobs.tick();
    expect(await database.client.vehicleStatusSample.count()).toBe(6);
    expect(await tripRows()).toEqual(initialTrips);
    expect(await fleetEvents()).toEqual(initialEvents);
    expect(await measurementRows()).toEqual(importedMeasurements);
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
    for (const [device, lastEventId, lastReceivedAt] of [
      [deviceA, 21n, at(420)],
      [stock, 22n, at(430)],
      [deviceB, 20n, at(70)],
    ] as const) {
      expect(
        await database.client.fleetErmCursor.findUniqueOrThrow({ where: { deviceId: device.id } }),
      ).toMatchObject({ lastEventId, lastReceivedAt });
    }
    expect(await database.client.vehicleStatusSample.count()).toBe(7);
    expect(await tripRows()).toEqual(initialTrips);

    const exportedDiagnostics: ExportNotification[] = (
      [
        ['3', 0, 'DIAGNOSTIC_TROUBLE_CODE', 'SPN 4339 FMI 7', 'ADDED', 'WARNING', '33'],
        ['3', 0, 'DIAGNOSTIC_TROUBLE_CODE', 'SPN 1247 FMI 11', 'DELETED', 'INFO', '33'],
        ['8', 300, 'CAN_ERROR', null, null, 'WARNING', null],
      ] as const
    ).map(
      ([
        sourceId,
        seconds,
        eventKind,
        troubleCode,
        diagnosticStatus,
        severity,
        alarmCode,
      ]): ExportNotification => ({
        sourceKind: 'DIAGNOSTIC',
        sourceId,
        sourceKey: JSON.stringify([
          deviceA.imei,
          at(seconds).toISOString(),
          eventKind,
          troubleCode,
          diagnosticStatus,
        ]),
        occurredAt: at(seconds).toISOString(),
        severity,
        wordingKey: 'notification.recordedDiagnostic',
        parameters: { eventKind, troubleCode, diagnosticStatus, alarmCode },
        target: { kind: 'DEVICE', id: deviceA.id },
        recorded: true,
      }),
    );
    for (const diagnostic of exportedDiagnostics) {
      expect(
        await database.client.fleetNotification.findFirstOrThrow({
          where: { ...scopeA, sourceKey: diagnostic.sourceKey },
        }),
      ).toMatchObject({
        sourceKind: diagnostic.sourceKind,
        parameters: diagnostic.parameters,
        wordingKey: diagnostic.wordingKey,
        occurredAt: new Date(diagnostic.occurredAt),
        createdAt: at(600),
        deviceId: deviceA.id,
        vehicleId: vehicleA.id,
      });
    }
    expect(await database.client.fleetNotification.count()).toBe(3);
    const commandId = randomUUID();
    const command: ExportNotification = {
      sourceKind: 'COMMAND',
      sourceId: commandId,
      sourceKey: `erm-command:${commandId}:ACKNOWLEDGED`,
      occurredAt: at(400).toISOString(),
      severity: 'INFO',
      wordingKey: 'notification.commandOutcome',
      parameters: { commandKind: 'READ_STATUS', commandStatus: 'ACKNOWLEDGED', reasonCode: null },
      target: { kind: 'DEVICE', id: deviceA.id },
      recorded: false,
    };
    const alarm: ExportNotification = {
      sourceKind: 'ALARM',
      sourceId: '500',
      sourceKey: 'erm-event:500',
      occurredAt: at(450).toISOString(),
      severity: 'WARNING',
      wordingKey: 'notification.recordedAlarm',
      parameters: { eventKind: 'DEVICE_ALARM', alarmCode: '51' },
      target: { kind: 'DEVICE', id: deviceB.id },
      recorded: true,
    };
    notifications.set(deviceA.imei, { items: [...exportedDiagnostics, command], next: 'page-a-1' });
    notifications.set(deviceB.imei, { items: [alarm], next: 'page-b-1' });
    await notificationJobs.tick();
    const notificationCursor = (device: typeof deviceA) =>
      database.client.fleetNotificationCursor.findUniqueOrThrow({
        where: {
          tenantId_branchId_sourceKey: {
            tenantId: device.tenantId,
            branchId: device.branchId,
            sourceKey: `erm:${device.id}`,
          },
        },
      });
    for (const [device, since, position] of [
      [deviceA, deviceA.createdAt, 'page-a-1'],
      [stock, at(600 - 7 * 86_400), 'empty'],
      [deviceB, deviceB.createdAt, 'page-b-1'],
    ] as const) {
      expect(await notificationCursor(device)).toMatchObject({
        tenantId: device.tenantId,
        branchId: device.branchId,
        since,
        position,
      });
      expect(Object.fromEntries(notificationRequests.get(device.imei)?.searchParams ?? [])).toEqual(
        {
          tenantId: device.tenantId,
          branchId: device.branchId,
          deviceId: device.id,
          since: since.toISOString(),
          limit: '500',
        },
      );
    }
    expect(await database.client.fleetNotification.count({ where: scopeA })).toBe(4);
    expect(await database.client.fleetNotification.findMany({ where: scopeB })).toMatchObject([
      { ...scopeB, sourceKey: alarm.sourceKey, deviceId: deviceB.id, vehicleId: vehicleB.id },
    ]);
    expect(
      await database.client.fleetNotification.findFirstOrThrow({
        where: { ...scopeA, commandRequestId: commandId },
      }),
    ).toMatchObject({ category: 'COMMAND', deviceId: deviceA.id, ermEventId: null });
    await notificationJobs.tick();
    expect(await database.client.fleetNotification.count()).toBe(5);
    expect(notificationRequests.get(deviceA.imei)?.searchParams.get('after')).toBe('page-a-1');

    notifications.set(deviceA.imei, {
      items: [{ ...alarm, target: { kind: 'DEVICE', id: deviceA.id } }],
      next: 'page-a-2',
    });
    notifications.set(deviceB.imei, { items: [], next: 'page-b-2' });
    notificationFailures.set(deviceA.imei, 'invalid');
    notificationFailures.set(deviceB.imei, 500);
    await notificationJobs.tick();
    expect(await notificationCursor(deviceA)).toMatchObject({ position: 'page-a-1' });
    expect(await notificationCursor(deviceB)).toMatchObject({ position: 'page-b-1' });
    expect(await database.client.fleetNotification.count()).toBe(5);
    notificationFailures.clear();
    await notificationJobs.tick();
    expect(await notificationCursor(deviceA)).toMatchObject({ position: 'page-a-2' });
    expect(await notificationCursor(deviceB)).toMatchObject({ position: 'page-b-2' });
    expect(await database.client.fleetNotification.count()).toBe(6);
    for (const selectedScope of [scopeA, scopeB]) {
      expect(
        await database.client.fleetNotification.count({
          where: { ...selectedScope, sourceKey: alarm.sourceKey },
        }),
      ).toBe(1);
    }
    expect(await database.client.fleetEvent.count()).toBe(3);

    failures.clear();
    events.get(deviceA.imei)?.push(
      {
        ...event('23', 300, null),
        eventId: '33',
        edata: {
          report: '413',
          faults: [
            { code: 'P1111', status: 'ADDED' },
            { code: 'P1111', status: 'DELETED' },
            { code: 'P1111', status: 'ADDED' },
          ],
        },
      },
      {
        ...event('24', 300, null),
        eventId: '33',
        edata: {
          report: '418',
          faults: [
            { code: 'P1482', status: 'ADDED' },
            { code: 'U0100', status: 'DELETED' },
          ],
        },
      },
      { ...event('25', 300, null), eventId: '33', edata: { report: '417', noCanMessages: true } },
    );
    await jobs.tick();
    const structuredRows = () =>
      database.client.fleetEvent.findMany({
        where: { ...scopeA, sourceEventId: { in: [23n, 24n, 25n] } },
        orderBy: [{ sourceEventId: 'asc' }, { diagnosticIndex: 'asc' }],
      });
    const structured = await structuredRows();
    expect(structured).toMatchObject(
      [
        {
          sourceEventId: 23n,
          diagnosticReport: 413,
          diagnosticIndex: 0,
          diagnosticStatus: 1,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'WARNING',
          troubleCode: 'P1111',
        },
        {
          sourceEventId: 23n,
          diagnosticReport: 413,
          diagnosticIndex: 1,
          diagnosticStatus: 2,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'INFO',
          troubleCode: 'P1111',
        },
        {
          sourceEventId: 23n,
          diagnosticReport: 413,
          diagnosticIndex: 2,
          diagnosticStatus: 1,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'WARNING',
          troubleCode: 'P1111',
        },
        {
          sourceEventId: 24n,
          diagnosticReport: 418,
          diagnosticIndex: 0,
          diagnosticStatus: 1,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'WARNING',
          troubleCode: 'P1482',
        },
        {
          sourceEventId: 24n,
          diagnosticReport: 418,
          diagnosticIndex: 1,
          diagnosticStatus: 2,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'INFO',
          troubleCode: 'U0100',
        },
        {
          sourceEventId: 25n,
          diagnosticReport: 417,
          diagnosticIndex: 0,
          diagnosticStatus: null,
          kind: 'CAN_DISCONNECTED',
          severity: 'WARNING',
          troubleCode: null,
        },
      ].map((fault) => ({
        ...scopeA,
        source: 'ERM',
        vehicleId: vehicleA.id,
        deviceImei: deviceA.imei,
        occurredAt: at(300),
        receivedAt: at(310),
        diagnosticSpn: null,
        diagnosticFmi: null,
        alertStatus: null,
        ...fault,
      })),
    );
    expect(await database.client.fleetEvent.count()).toBe(9);
    expect(await database.client.fleetEvent.count({ where: scopeB })).toBe(0);
    await database.client.fleetErmCursor.update({
      where: { ...scopeA, deviceId: deviceA.id },
      data: { lastEventId: 0n },
    });
    await jobs.tick();
    expect(await structuredRows()).toEqual(structured);
    expect(await database.client.fleetEvent.count()).toBe(9);
    expect(await database.client.vehicleStatusSample.count()).toBe(7);
    expect(await tripRows()).toEqual(initialTrips);
    expect(await database.client.fleetNotification.count()).toBe(6);
    const lastValidCursor = await database.client.fleetErmCursor.findUniqueOrThrow({
      where: { ...scopeA, deviceId: deviceA.id },
    });
    expect(lastValidCursor).toMatchObject({ lastEventId: 25n, lastReceivedAt: at(420) });
    const malformed: FeedEvent = { ...event('26', 300, null), eventId: '33' };
    events.get(deviceA.imei)?.push(malformed);
    for (const edata of [
      { report: '413', faults: [{ code: 'P1111', status: 'UNKNOWN' }] },
      { report: '418', faults: [{ code: 'P1', status: 'ADDED' }] },
      { report: '417', noCanMessages: false },
    ]) {
      malformed.edata = edata;
      await jobs.tick();
      expect(
        await database.client.fleetErmCursor.findUniqueOrThrow({
          where: { ...scopeA, deviceId: deviceA.id },
        }),
      ).toEqual(lastValidCursor);
      expect(await database.client.fleetEvent.count()).toBe(9);
    }

    events.get(deviceA.imei)?.pop();
    const lampVehicle = await database.client.vehicle.create({
      data: { ...scopeA, licensePlate: 'ERM LAMPS' },
    });
    const lampDevice = await database.client.device.create({
      data: {
        ...scopeA,
        imei: '000000000000104',
        vehicleId: lampVehicle.id,
        installedAt,
        createdAt: installedAt,
      },
    });
    for (const selectedScope of [
      { tenantId: scopeA.tenantId, branchId: scopeB.branchId },
      { tenantId: scopeB.tenantId, branchId: scopeA.branchId },
      scopeA,
    ]) {
      const previousVehicle = await database.client.vehicle.create({
        data: { ...selectedScope, licensePlate: 'UNRELATED LAMP' },
      });
      await database.client.vehicleEdataMeasurement.create({
        data: {
          ...selectedScope,
          vehicleId: previousVehicle.id,
          deviceImei: lampDevice.imei,
          source: 'ERM',
          sourceEventId: 99n,
          recordedAt: at(-1),
          receivedAt: at(-1),
          parameterId: 1896,
          parameterType: 0,
          valueSize: 1,
          valueHex: '01',
        },
      });
    }
    const lampEvent = (
      id: string,
      seconds: number,
      brake: string,
      engine = '00',
      abs = '00',
    ): FeedEvent => ({
      ...event(id, seconds, null),
      edata: {
        report: '405',
        measurements: [
          [1896, brake],
          [1906, engine],
          [1910, abs],
        ].map(([parameterId, valueHex]) => ({
          parameterId,
          parameterType: 0,
          valueSize: 1,
          valueHex,
        })),
      },
    });
    const lampNotifications = () =>
      database.client.fleetNotification.findMany({
        where: { ...scopeA, deviceId: lampDevice.id },
        orderBy: [{ occurredAt: 'asc' }, { sourceKey: 'asc' }],
      });
    const startupEvents: FeedEvent[] = [];
    events.set(lampDevice.imei, startupEvents);
    for (const [id, seconds, engineOn, brake, state] of [
      ['97', 0, false, '01', 'UNKNOWN'],
      ['98', 1, true, '00', 'OFF'],
    ] as const) {
      startupEvents.push({ ...lampEvent(id, seconds, brake), engineOn });
      await jobs.tick();
      expect(
        await database.client.vehicleEdataMeasurement.findMany({
          where: { ...scopeA, vehicleId: lampVehicle.id, sourceEventId: BigInt(id) },
          select: { parameterId: true, valueHex: true },
          orderBy: { parameterId: 'asc' },
        }),
      ).toEqual(
        engineOn ? [1896, 1906, 1910].map((parameterId) => ({ parameterId, valueHex: '00' })) : [],
      );
      expect(await lampNotifications()).toEqual([]);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issueDemoToken(scopeA.tenantId)}`,
          'x-branch-id': scopeA.branchId,
        },
        body: JSON.stringify({
          query:
            'query($id:ID!){fleetDevice(id:$id){warningLamps{parameterId state} currentWarnings{parameterId}}}',
          variables: { id: lampDevice.id },
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(await response.json()).toEqual({
        data: {
          fleetDevice: {
            warningLamps: [1896, 1906, 1910].map((parameterId) => ({ parameterId, state })),
            currentWarnings: [],
          },
        },
      });
    }
    events.set(lampDevice.imei, [
      ...startupEvents,
      lampEvent('100', 2, '00'),
      { ...lampEvent('101', 10, '01'), engineOn: true },
      lampEvent('102', 20, '01'),
      lampEvent('103', 30, '00'),
      lampEvent('104', 40, '02'),
      lampEvent('105', 50, '02'),
      lampEvent('106', 60, '00'),
      lampEvent('107', 70, '03'),
      lampEvent('108', 80, '04'),
      lampEvent('109', 90, '05'),
      lampEvent('110', 100, '07'),
      lampEvent('111', 110, '01', '02', '01'),
      lampEvent('112', 110, '02', '02', '01'),
      lampEvent('113', 120, '00'),
    ]);
    await jobs.tick();
    const lampTransitions = await lampNotifications();
    expect(lampTransitions).toHaveLength(11);
    expect(lampTransitions).toEqual(
      expect.arrayContaining(
        (
          [
            [10, 'BRAKE_SYSTEM', 'RED', 'OFF', 'CRITICAL'],
            [30, 'BRAKE_SYSTEM', 'OFF', 'RED', 'INFO'],
            [40, 'BRAKE_SYSTEM', 'YELLOW', 'OFF', 'WARNING'],
            [60, 'BRAKE_SYSTEM', 'OFF', 'YELLOW', 'INFO'],
            [110, 'BRAKE_SYSTEM', 'RED', 'NOT_AVAILABLE', 'CRITICAL'],
            [110, 'BRAKE_SYSTEM', 'YELLOW', 'RED', 'WARNING'],
            [110, 'ENGINE', 'YELLOW', 'OFF', 'WARNING'],
            [110, 'ABS', 'RED', 'OFF', 'CRITICAL'],
            [120, 'BRAKE_SYSTEM', 'OFF', 'YELLOW', 'INFO'],
            [120, 'ENGINE', 'OFF', 'YELLOW', 'INFO'],
            [120, 'ABS', 'OFF', 'RED', 'INFO'],
          ] as const
        ).map(([seconds, lamp, state, previousState, severity]) =>
          expect.objectContaining({
            ...scopeA,
            sourceKind: 'DIAGNOSTIC',
            category: 'DEVICE',
            severity,
            occurredAt: at(seconds),
            createdAt: at(600),
            wordingKey:
              state === 'OFF' ? 'notification.warningLampOff' : 'notification.warningLampEntered',
            parameters: {
              lamp,
              state,
              previousState,
              deviceId: lampDevice.id,
              vehicleId: lampVehicle.id,
            },
            deviceId: lampDevice.id,
            vehicleId: lampVehicle.id,
          }),
        ),
      ),
    );
    await jobs.tick();
    expect(await lampNotifications()).toEqual(lampTransitions);
    await database.client.fleetErmCursor.update({
      where: { ...scopeA, deviceId: lampDevice.id },
      data: { lastEventId: 0n },
    });
    await jobs.tick();
    expect(await lampNotifications()).toEqual(lampTransitions);
    events.get(lampDevice.imei)?.push(lampEvent('114', 90, '01'));
    await jobs.tick();
    expect(await lampNotifications()).toEqual(lampTransitions);

    for (const selectedScope of [
      scopeA,
      { tenantId: scopeA.tenantId, branchId: scopeB.branchId },
      { tenantId: scopeB.tenantId, branchId: scopeA.branchId },
    ]) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}`,
          'x-branch-id': selectedScope.branchId,
        },
        body: JSON.stringify({
          query:
            'query($ids:[ID!]){notifications(ids:$ids){total items{wordingKey parameters{lamp state previousState deviceId vehicleId}}}}',
          variables: { ids: lampTransitions.map(({ id }) => id) },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const body: unknown = await response.json();
      if (selectedScope === scopeA) {
        expect(body).toMatchObject({
          data: {
            notifications: {
              total: lampTransitions.length,
              items: expect.arrayContaining(
                lampTransitions.map(({ wordingKey, parameters }) => ({ wordingKey, parameters })),
              ),
            },
          },
        });
      } else {
        expect(body).toEqual({ data: { notifications: { total: 0, items: [] } } });
      }
    }

    // An eData 415 freeze frame keeps every value, scaled by the catalog when read, and never
    // replaces the 405 lamp state or the measurement series.
    await database.client.edataCatalogParameter.updateMany({
      where: { catalogId: catalog.id, parameterId: 1 },
      data: { multiply: '0.125', offset: '0.0' },
    });
    events.get(lampDevice.imei)?.push({
      ...event('115', 130, false),
      eventId: '33',
      edata: {
        report: '415',
        measurements: [
          { parameterId: 1, parameterType: 0, valueSize: 2, valueHex: '05DC' },
          { parameterId: 1896, parameterType: 0, valueSize: 1, valueHex: '01' },
        ],
      },
    });
    await jobs.tick();
    expect(await lampNotifications()).toEqual(lampTransitions);
    for (const selectedScope of [
      scopeA,
      { tenantId: scopeA.tenantId, branchId: scopeB.branchId },
    ]) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}`,
          'x-branch-id': selectedScope.branchId,
        },
        body: JSON.stringify({
          query:
            'query($id:ID!,$from:DateTime!,$to:DateTime!){fleetVehicleFreezeFrame(vehicleId:$id){deviceImei recordedAt values{parameterId name unit valueHex value}} fleetVehicleEdataMeasurements(vehicleId:$id,from:$from,to:$to,parameterIds:[1]){items{valueHex}}}',
          variables: {
            id: lampVehicle.id,
            from: installedAt.toISOString(),
            to: at(360).toISOString(),
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const body: unknown = await response.json();
      if (selectedScope === scopeA) {
        expect(body).toEqual({
          data: {
            fleetVehicleFreezeFrame: {
              deviceImei: lampDevice.imei,
              recordedAt: at(130).toISOString(),
              values: [
                {
                  parameterId: 1,
                  name: 'Engine Speed (RPM)',
                  unit: 'RPM',
                  valueHex: '05DC',
                  value: 187.5,
                },
                { parameterId: 1896, name: null, unit: null, valueHex: '01', value: null },
              ],
            },
            fleetVehicleEdataMeasurements: { items: [] },
          },
        });
      } else {
        const notFound = { extensions: { code: 'NOT_FOUND' } };
        expect(body).toMatchObject({ errors: [notFound, notFound] });
      }
    }
    const lampResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeA.tenantId)}`,
        'x-branch-id': scopeA.branchId,
      },
      body: JSON.stringify({
        query: 'query($id:ID!){fleetDevice(id:$id){warningLamps{parameterId state}}}',
        variables: { id: lampDevice.id },
      }),
      signal: AbortSignal.timeout(10000),
    });
    expect(await lampResponse.json()).toEqual({
      data: {
        fleetDevice: {
          warningLamps: [1896, 1906, 1910].map((parameterId) => ({ parameterId, state: 'OFF' })),
        },
      },
    });
  });
});
