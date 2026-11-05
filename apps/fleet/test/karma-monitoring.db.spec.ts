import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import {
  KarmaDeviceReadError,
  KarmaDeviceReadsClient,
} from '../src/integrations/karma/karma-device-reads.client.js';
import { KarmaMonitoringJobs } from '../src/modules/karma-monitoring/karma-monitoring.jobs.js';
import {
  KarmaMonitoringRepository,
  monitoringDefaults,
} from '../src/modules/karma-monitoring/karma-monitoring.repository.js';
import { DeviceOperationsRepository } from '../src/modules/device-operations/device-operations.repository.js';
import { createTestDatabase } from './test-database.js';

const now = new Date('2026-11-02T12:00:00.000Z');
const scope = { tenantId: randomUUID(), branchId: randomUUID() };
const otherScopes = [
  { ...scope, tenantId: randomUUID() },
  { ...scope, branchId: randomUUID() },
];
const settingsFields =
  'enabled statusPollSeconds offlineAfterMinutes faultHistoryPollMinutes faultCommandEnabled faultCommandMinutes retentionDays';

describe('Karma monitoring persistence and scope', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication | undefined;
  let repository: KarmaMonitoringRepository;
  let operations: DeviceOperationsRepository;
  let jobs: KarmaMonitoringJobs;
  let url = '';
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const monitoring = jest.fn<KarmaDeviceReadsClient['monitoring']>();
  const originalFlag = process.env.FLEET_KARMA_MONITORING_ENABLED;
  const originalDispatchFlag = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  const originalTelemetryFlag = process.env.FLEET_ERM_TELEMETRY_ENABLED;
  const originalRecoveryFlag = process.env.FLEET_ERM_RECOVERY_ENABLED;
  beforeAll(async () => {
    process.env.FLEET_KARMA_MONITORING_ENABLED = 'false';
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'false';
    process.env.FLEET_ERM_TELEMETRY_ENABLED = 'false';
    process.env.FLEET_ERM_RECOVERY_ENABLED = 'false';
    database = await createTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .overrideProvider(KarmaDeviceReadsClient)
      .useValue({ monitoring })
      .compile();
    repository = module.get(KarmaMonitoringRepository);
    operations = module.get(DeviceOperationsRepository);
    jobs = module.get(KarmaMonitoringJobs);
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    for (const cron of module.get(SchedulerRegistry).getCronJobs().values()) {
      await cron.stop();
    }
    url = `${await app.getUrl()}/graphql`;
  });
  afterAll(async () => {
    if (originalFlag === undefined) {
      delete process.env.FLEET_KARMA_MONITORING_ENABLED;
    } else {
      process.env.FLEET_KARMA_MONITORING_ENABLED = originalFlag;
    }
    if (originalDispatchFlag === undefined) {
      delete process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
    } else {
      process.env.FLEET_DEVICE_OPERATIONS_ENABLED = originalDispatchFlag;
    }
    if (originalTelemetryFlag === undefined) {
      delete process.env.FLEET_ERM_TELEMETRY_ENABLED;
    } else {
      process.env.FLEET_ERM_TELEMETRY_ENABLED = originalTelemetryFlag;
    }
    if (originalRecoveryFlag === undefined) {
      delete process.env.FLEET_ERM_RECOVERY_ENABLED;
    } else {
      process.env.FLEET_ERM_RECOVERY_ENABLED = originalRecoveryFlag;
    }
    try {
      await app?.close();
    } finally {
      await database.close();
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown>,
    selectedScope = scope,
    authenticated = true,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-branch-id': selectedScope.branchId,
        ...(authenticated
          ? { authorization: `Bearer ${issueDemoToken(selectedScope.tenantId)}` }
          : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const result: unknown = await response.json();
    return result;
  }

  it('isolates settings, trucks, cursor writes and deduplicated fault/event pages by verified Tenant and Branch', async () => {
    const read = `{fleetKarmaMonitoringSettings{${settingsFields}}}`;
    const update = `mutation($input:UpdateFleetKarmaMonitoringSettingsInput!){updateFleetKarmaMonitoringSettings(input:$input){${settingsFields}}}`;
    expect(await query(read, {})).toEqual({
      data: { fleetKarmaMonitoringSettings: monitoringDefaults },
    });
    expect(await database.client.karmaMonitoringSettings.count()).toBe(0);
    const input = {
      ...monitoringDefaults,
      statusPollSeconds: 30,
      offlineAfterMinutes: 2,
      retentionDays: 1,
    };
    expect(await query(update, { input })).toEqual({
      data: { updateFleetKarmaMonitoringSettings: input },
    });
    expect(requireBranch).toHaveBeenCalledWith(scope.branchId, expect.objectContaining(scope));
    for (const selected of otherScopes) {
      expect(await query(read, {}, selected)).toEqual({
        data: { fleetKarmaMonitoringSettings: monitoringDefaults },
      });
      await repository.observe(
        selected,
        { karmaCarId: '7', karmaDeviceId: 'opaque-7', displayName: 'OTHER', lastDataAt: null },
        15,
        now,
      );
    }
    for (const [field, value] of Object.entries({
      statusPollSeconds: 29,
      offlineAfterMinutes: 1441,
      faultHistoryPollMinutes: 4,
      faultCommandMinutes: 14,
      retentionDays: 31,
    })) {
      expect(await query(update, { input: { ...input, [field]: value } })).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    }
    expect(await query(read, {}, scope, false)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    requireBranch.mockRejectedValueOnce(new NotFoundException('Branch not found'));
    expect(await query(update, { input }, { ...scope, branchId: randomUUID() })).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    const truck = await repository.observe(
      scope,
      {
        karmaCarId: '7',
        karmaDeviceId: 'opaque-7',
        displayName: 'TRUCK',
        lastDataAt: new Date(now.getTime() - 60_000),
      },
      2,
      now,
    );
    const sourceTime = new Date(now.getTime() - 3_600_000);
    const fault = {
      karmaCarId: '7',
      kind: 'FAULT_REPORTED' as const,
      source: 'KARMA_HISTORY' as const,
      sourceKey: '7:100:0',
      occurredAt: sourceTime,
      recordedAt: now,
      code: 'P0001',
      spn: 4294967295,
      fmi: 3,
      faultStatus: 'ADDED',
      rawRecord: { message_id: 100, extra: 'original' },
    };
    const decoded = {
      messageId: '100',
      occurredAt: sourceTime.toISOString(),
      rawRecord: fault.rawRecord,
      reportCode: '419',
      decoding: 'DECODED',
      faults: [{ code: fault.code, spn: fault.spn, fmi: fault.fmi, status: fault.faultStatus }],
    };
    const batch = {
      highWatermark: '100',
      nextBeforeId: null,
      hasMore: false,
      reports: [
        {
          ...decoded,
          messageId: '97',
          occurredAt: new Date(now.getTime() - 86_400_001).toISOString(),
        },
        {
          ...decoded,
          messageId: '98',
          reportCode: '2',
          decoding: 'OPAQUE',
          faults: [],
          rawRecord: { eid: 2, pdt: '2026-11-02 11:00:00', edt: null, extra: '4,11' },
        },
        { ...decoded, messageId: '99', reportCode: '418', decoding: 'OPAQUE', faults: [] },
        decoded,
      ],
    };
    monitoring
      .mockResolvedValueOnce({
        ...batch,
        hasMore: true,
        nextBeforeId: '98',
        reports: batch.reports.filter((report) => Number(report.messageId) > 98),
      })
      .mockResolvedValue({
        ...batch,
        highWatermark: '98',
        reports: batch.reports.filter((report) => Number(report.messageId) <= 98),
      });
    const stored = await repository.settings(scope);
    if (!stored) {
      throw new Error('Missing monitoring settings');
    }
    const active = {
      ...stored,
      enabled: true,
      faultCommandEnabled: false,
      lastStatusPollAt: now,
      lastRetentionAt: now,
    };
    await jobs.runBranch(active, now);
    expect((await repository.trucks(scope))[0]).toMatchObject({
      historyCursor: '0',
      historyBeforeId: '98',
      historyHighWatermark: '100',
      lastHistoryPollAt: null,
    });
    await jobs.runBranch(active, now);
    expect(monitoring.mock.calls[0]).toEqual([
      'history',
      {
        carId: '7',
        deviceId: 'opaque-7',
        afterId: '0',
        fromUtc: '2026-11-01T12:00:00.000Z',
        toUtc: now.toISOString(),
      },
    ]);
    expect(monitoring.mock.calls[1]).toEqual([
      'history',
      expect.objectContaining({ afterId: '0', beforeId: '98' }),
    ]);
    expect((await repository.trucks(scope))[0]).toMatchObject({
      historyCursor: '100',
      historyBeforeId: null,
      historyHighWatermark: null,
      lastHistoryPollAt: now,
    });
    expect(
      await database.client.karmaMonitoringEvent.findMany({
        where: { ...scope, source: 'KARMA_HISTORY' },
        orderBy: { sourceKey: 'asc' },
        select: { kind: true, sourceKey: true, occurredAt: true, recordedAt: true },
      }),
    ).toEqual([
      { kind: 'FAULT_REPORTED', sourceKey: '7:100:0', occurredAt: sourceTime, recordedAt: now },
      {
        kind: 'FAULT_REPORT_UNDECODED',
        sourceKey: '7:99:undecoded',
        occurredAt: sourceTime,
        recordedAt: now,
      },
    ]);
    const expired = new Date(now.getTime() - 86_400_001);
    await repository.record(scope, [{ ...fault, sourceKey: '7:96:0', occurredAt: expired }]);
    await repository.updateTruck(otherScopes[0] ?? scope, '7', { historyCursor: '200' });
    expect((await repository.trucks(scope))[0]?.historyCursor).toBe('100');
    const trucks =
      '{fleetKarmaMonitoringTrucks(filter:{online:true,withFaults:true}){onlineTotal noDataTotal withFaultsTotal total items{id displayName online faults{code spn} latestFault{faultStatus}}}}';
    expect(await query(trucks, {})).toEqual({
      data: {
        fleetKarmaMonitoringTrucks: {
          total: 1,
          onlineTotal: 1,
          noDataTotal: 0,
          withFaultsTotal: 1,
          items: [
            {
              id: truck.id,
              displayName: 'TRUCK',
              online: true,
              faults: [{ code: 'P0001', spn: 4294967295 }],
              latestFault: { faultStatus: 'ADDED' },
            },
          ],
        },
      },
    });
    expect(
      await query(
        '{fleetKarmaMonitoringTrucks(filter:{withFaults:false},limit:1){total onlineTotal noDataTotal withFaultsTotal items{id}}}',
        {},
      ),
    ).toEqual({
      data: {
        fleetKarmaMonitoringTrucks: {
          total: 0,
          onlineTotal: 1,
          noDataTotal: 0,
          withFaultsTotal: 1,
          items: [],
        },
      },
    });
    expect(
      await repository.listTrucks(
        scope,
        { offset: 0, limit: 20 },
        { tokens: [], ids: undefined, online: undefined, withFaults: undefined },
        { field: 'DISPLAY_NAME', direction: 'ASC' },
        new Date(now.getTime() + 86_400_000),
      ),
    ).toMatchObject({ withFaultsTotal: 0, items: [{ faults: [], latestFault: null }] });
    const events =
      '{fleetKarmaMonitoringEvents(filter:{karmaCarId:"7",kinds:[FAULT_REPORTED],from:"2026-11-02T00:00:00Z"},limit:1){total offset limit items{code rawRecord}}}';
    expect(await query(events, {})).toEqual({
      data: {
        fleetKarmaMonitoringEvents: {
          total: 1,
          offset: 0,
          limit: 1,
          items: [{ code: 'P0001', rawRecord: '{"extra":"original","message_id":100}' }],
        },
      },
    });
    for (const selected of otherScopes) {
      expect(await query(trucks, {}, selected)).toMatchObject({
        data: {
          fleetKarmaMonitoringTrucks: {
            total: 0,
            onlineTotal: 0,
            noDataTotal: 1,
            withFaultsTotal: 0,
            items: [],
          },
        },
      });
      expect(await query(events, {}, selected)).toMatchObject({
        data: { fleetKarmaMonitoringEvents: { total: 0, items: [] } },
      });
    }
    monitoring.mockRejectedValueOnce(new KarmaDeviceReadError('KARMA_TIMEOUT'));
    await repository.updateTruck(scope, '7', { lastHistoryPollAt: null });
    await jobs.runBranch(active, now);
    expect(
      await database.client.karmaMonitoringEvent.findFirst({
        where: { ...scope, kind: 'POLL_FAILED', source: 'KARMA_HISTORY' },
        select: { details: true },
      }),
    ).toEqual({
      details:
        'Karma monitoring request failed (KARMA_TIMEOUT); no successful or empty result is inferred.',
    });

    const vehicle = await database.client.vehicle.create({
      data: { ...scope, licensePlate: 'BACKUP' },
    });
    const device = await database.client.device.create({
      data: { ...scope, imei: '000000000000070', vehicleId: vehicle.id },
    });
    const neverReported = await database.client.device.create({
      data: { ...scope, imei: '000000000000071' },
    });
    const importedAt = new Date(now.getTime() - 10 * 60_000);
    const firstAheadAt = new Date(now.getTime() - 60_000);
    await database.client.fleetErmCursor.create({
      data: { ...scope, deviceId: device.id, lastEventId: 1n, lastReceivedAt: importedAt },
    });
    for (const selected of [scope, ...otherScopes]) {
      await repository.observe(
        selected,
        {
          karmaCarId: '70',
          karmaDeviceId: device.imei,
          displayName: 'BACKUP',
          lastDataAt: firstAheadAt,
        },
        2,
        now,
      );
    }
    await repository.observe(
      scope,
      {
        karmaCarId: '71',
        karmaDeviceId: neverReported.imei,
        displayName: 'NEVER REPORTED',
        lastDataAt: firstAheadAt,
      },
      2,
      now,
    );
    const pollSettings = { ...active, lastStatusPollAt: null };
    async function poll(lastDataAt: Date, polledAt = now) {
      await database.client.karmaMonitoringTruck.updateMany({
        where: scope,
        data: { lastHistoryPollAt: polledAt },
      });
      monitoring.mockResolvedValueOnce([
        {
          carId: '70',
          deviceId: device.imei,
          displayName: 'BACKUP',
          lastDataAt: lastDataAt.toISOString(),
        },
        {
          carId: '71',
          deviceId: neverReported.imei,
          displayName: 'NEVER REPORTED',
          lastDataAt: lastDataAt.toISOString(),
        },
      ]);
      await jobs.runBranch(pollSettings, polledAt);
    }
    const routingTruck = () =>
      database.client.karmaMonitoringTruck.findUniqueOrThrow({
        where: { tenantId_branchId_karmaCarId: { ...scope, karmaCarId: '70' } },
      });
    const backupEvents = () =>
      database.client.fleetEvent.findMany({ where: { ...scope, kind: 'UNIT_ON_BACKUP' } });
    const deviceRouting = `query($id:ID!,$ids:[ID!]!){
      fleetDevice(id:$id){routing}
      fleetDevices(ids:$ids,sort:{field:IMEI,direction:ASC}){items{id routing}}
    }`;
    const deviceIds = { id: device.id, ids: [device.id, neverReported.id] };
    process.env.FLEET_ERM_TELEMETRY_ENABLED = 'true';
    await poll(firstAheadAt);
    expect(await routingTruck()).toMatchObject({
      routing: 'HOLITA',
      routingAheadPolls: 1,
      routingAheadSince: firstAheadAt,
    });
    expect(await backupEvents()).toHaveLength(0);
    monitoring.mockRejectedValueOnce(new KarmaDeviceReadError('KARMA_TIMEOUT'));
    await jobs.runBranch(pollSettings, now);
    expect(await routingTruck()).toMatchObject({
      routing: 'HOLITA',
      routingAheadPolls: 1,
      routingAheadSince: firstAheadAt,
    });
    await poll(now);
    expect(await routingTruck()).toMatchObject({
      routing: 'KARMA_BACKUP',
      routingAheadPolls: 2,
      routingAheadSince: firstAheadAt,
    });
    expect(await backupEvents()).toMatchObject([
      {
        ...scope,
        source: 'ERM',
        deviceImei: device.imei,
        vehicleId: vehicle.id,
        kind: 'UNIT_ON_BACKUP',
        severity: 'WARNING',
        occurredAt: firstAheadAt,
        details: `Karma received data at ${firstAheadAt.toISOString()} while holita's last import was ${importedAt.toISOString()}; the unit is reporting to its Karma backup.`,
        troubleCode: null,
        tripId: null,
        driverId: null,
        intensity: null,
        latitude: null,
        longitude: null,
        address: null,
        speedKph: null,
        measuredValue: null,
        thresholdValue: null,
        alertStatus: null,
        acknowledgedAt: null,
        resolvedAt: null,
        remark: null,
      },
    ]);
    expect(await query(deviceRouting, deviceIds)).toEqual({
      data: {
        fleetDevice: { routing: 'KARMA_BACKUP' },
        fleetDevices: {
          items: [
            { id: device.id, routing: 'KARMA_BACKUP' },
            { id: neverReported.id, routing: null },
          ],
        },
      },
    });
    const parkedAt = new Date(now.getTime() - 11 * 60_000);
    await repository.updateTruck(scope, '70', { ignitionOffAt: parkedAt });
    const recovery = await repository.beginRecovery(scope, await routingTruck(), now);
    if (recovery === null) {
      throw new Error('Missing recovery intent');
    }
    expect(recovery).toMatchObject({
      ...scope,
      deviceImei: device.imei,
      status: 'SUBMITTING',
      ignitionOffAt: parkedAt,
    });
    expect(await repository.beginRecovery(scope, await routingTruck(), now)).toBeNull();
    for (const selected of otherScopes) {
      expect(await repository.beginRecovery(selected, await routingTruck(), now)).toBeNull();
      await repository.completeRecovery(
        selected,
        recovery,
        { status: 'ACCEPTED', queueIds: ['999'], errorCode: null },
        now,
      );
    }
    expect(
      await database.client.karmaRecoveryAttempt.findUniqueOrThrow({
        where: { id: recovery.id },
      }),
    ).toMatchObject({ status: 'SUBMITTING', queueIds: [] });
    await repository.completeRecovery(
      scope,
      recovery,
      { status: 'UNCERTAIN', queueIds: [], errorCode: 'KARMA_TIMEOUT' },
      now,
    );
    const later = new Date(now.getTime() + 2 * 60 * 60_000);
    await repository.updateTruck(scope, '70', { lastDataAt: later, ignitionOffAt: parkedAt });
    expect(await repository.beginRecovery(scope, await routingTruck(), later)).toBeNull();
    await repository.updateTruck(scope, '70', { lastDataAt: now });
    expect(
      await query(
        'query($id:ID!){fleetDevice(id:$id){latestRecoveryAttempt{id status ignitionOffAt queueIds errorCode}}}',
        { id: device.id },
      ),
    ).toEqual({
      data: {
        fleetDevice: {
          latestRecoveryAttempt: {
            id: recovery.id,
            status: 'UNCERTAIN',
            ignitionOffAt: parkedAt.toISOString(),
            queueIds: [],
            errorCode: 'KARMA_TIMEOUT',
          },
        },
      },
    });
    expect(monitoring.mock.calls.some(([action]) => action === 'recovery')).toBe(false);
    await poll(now);
    expect(await backupEvents()).toHaveLength(1);
    process.env.FLEET_ERM_TELEMETRY_ENABLED = 'false';
    await poll(now);
    expect(await routingTruck()).toMatchObject({ routing: 'KARMA_BACKUP', routingAheadPolls: 3 });
    expect(await query(deviceRouting, deviceIds)).toEqual({
      data: {
        fleetDevice: { routing: null },
        fleetDevices: {
          items: [
            { id: device.id, routing: null },
            { id: neverReported.id, routing: null },
          ],
        },
      },
    });
    process.env.FLEET_ERM_TELEMETRY_ENABLED = 'true';
    await database.client.fleetErmCursor.update({
      where: { ...scope, deviceId: device.id },
      data: { lastReceivedAt: now },
    });
    await poll(now);
    expect(await routingTruck()).toMatchObject({
      routing: 'HOLITA',
      recoveryBlocked: false,
      routingAheadPolls: 0,
      routingAheadSince: null,
    });
    await poll(now, new Date(now.getTime() + 71 * 60_000));
    expect(await routingTruck()).toMatchObject({
      routing: 'SILENT',
      routingAheadPolls: 0,
      routingAheadSince: null,
    });
    expect(await backupEvents()).toHaveLength(1);
    for (const selected of otherScopes) {
      expect(
        await database.client.karmaMonitoringTruck.findUniqueOrThrow({
          where: { tenantId_branchId_karmaCarId: { ...selected, karmaCarId: '70' } },
        }),
      ).toMatchObject({ routing: null, routingAheadPolls: 0, routingAheadSince: null });
      expect(await database.client.fleetEvent.count({ where: selected })).toBe(0);
      expect(
        await query('query($id:ID!){fleetDevice(id:$id){routing}}', { id: device.id }, selected),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
  });

  it('prunes only old events and monitoring operations in the requested scope and enforces stored settings/read constraints', async () => {
    const old = new Date(now.getTime() - 11 * 86_400_000);
    const cutoff = new Date(now.getTime() - 10 * 86_400_000);
    for (const selected of [scope, ...otherScopes]) {
      await repository.record(selected, [
        {
          kind: 'POLL_FAILED',
          source: 'STATUS_POLL',
          sourceKey: 'old',
          occurredAt: old,
          recordedAt: old,
        },
        {
          kind: 'POLL_FAILED',
          source: 'STATUS_POLL',
          sourceKey: 'boundary',
          occurredAt: cutoff,
          recordedAt: cutoff,
        },
      ]);
      await database.client.fleetDeviceOperation.createMany({
        data: [
          {
            ...selected,
            karmaCarId: '8',
            karmaDeviceId: 'opaque-8',
            kind: 'READ_FAULT_LOGGER',
            phase: 'READ_DIAGNOSTICS',
            monitoringOrigin: true,
            status: 'FAILED',
            requestedAt: old,
            completedAt: old,
            nextCheckAt: old,
            deadlineAt: new Date(old.getTime() + 600_000),
          },
          {
            ...selected,
            karmaCarId: '8',
            karmaDeviceId: 'opaque-8',
            kind: 'READ_FAULT_LOGGER',
            phase: 'READ_DIAGNOSTICS',
            status: 'FAILED',
            requestedAt: old,
            completedAt: old,
            nextCheckAt: old,
            deadlineAt: new Date(old.getTime() + 600_000),
          },
        ],
      });
    }
    const pending = await operations.create(
      scope,
      { karmaCarId: '9', karmaDeviceId: 'opaque-9' },
      old,
      'READ_FAULT_LOGGER',
      true,
    );
    await repository.prune(scope, cutoff);
    await operations.pruneMonitoring(scope, cutoff);
    expect(
      await database.client.karmaMonitoringEvent.count({ where: { ...scope, sourceKey: 'old' } }),
    ).toBe(0);
    expect(
      await database.client.karmaMonitoringEvent.count({
        where: { ...scope, sourceKey: 'boundary' },
      }),
    ).toBe(1);
    expect(await operations.find(scope, pending.id)).toBeNull();
    expect(
      await operations.diagnosticHistory(scope, { karmaCarId: '8', karmaDeviceId: 'opaque-8' }),
    ).toHaveLength(1);
    expect(
      await database.client.fleetDeviceOperation.count({
        where: { ...scope, monitoringOrigin: true, status: 'FAILED' },
      }),
    ).toBe(0);
    for (const selected of otherScopes) {
      expect(
        await database.client.karmaMonitoringEvent.count({
          where: { ...selected, sourceKey: 'old' },
        }),
      ).toBe(1);
      expect(
        await database.client.fleetDeviceOperation.count({
          where: { ...selected, monitoringOrigin: true, status: 'FAILED' },
        }),
      ).toBe(1);
    }
    await expect(
      database.client.karmaMonitoringSettings.updateMany({
        where: scope,
        data: { retentionDays: 31 },
      }),
    ).rejects.toThrow();
    await expect(
      database.client.fleetDeviceOperation.create({
        data: {
          ...scope,
          karmaCarId: '10',
          karmaDeviceId: 'opaque-10',
          monitoringOrigin: true,
          nextCheckAt: now,
          deadlineAt: now,
        },
      }),
    ).rejects.toThrow();
  });
});
