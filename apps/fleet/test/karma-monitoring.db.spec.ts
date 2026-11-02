import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
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
  let url = '';
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const originalFlag = process.env.FLEET_KARMA_MONITORING_ENABLED;
  const originalDispatchFlag = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  beforeAll(async () => {
    process.env.FLEET_KARMA_MONITORING_ENABLED = 'false';
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'false';
    database = await createTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .compile();
    repository = module.get(KarmaMonitoringRepository);
    operations = module.get(DeviceOperationsRepository);
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
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
    const fault = {
      karmaCarId: '7',
      kind: 'FAULT_REPORTED' as const,
      source: 'KARMA_HISTORY' as const,
      sourceKey: '7:100:0',
      occurredAt: now,
      recordedAt: now,
      code: 'P0001',
      spn: 4294967295,
      fmi: 3,
      faultStatus: 'ADDED',
      rawRecord: { message_id: 100, extra: 'original' },
    };
    for (let repeat = 0; repeat < 2; repeat++) {
      await repository.saveHistory(scope, '7', [fault], { historyCursor: '100' });
    }
    await repository.updateTruck(otherScopes[0] ?? scope, '7', { historyCursor: '200' });
    expect((await repository.trucks(scope))[0]?.historyCursor).toBe('100');
    const trucks =
      '{fleetKarmaMonitoringTrucks(filter:{online:true}){total items{id displayName online faults{code spn} latestFault{faultStatus}}}}';
    expect(await query(trucks, {})).toEqual({
      data: {
        fleetKarmaMonitoringTrucks: {
          total: 1,
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
        data: { fleetKarmaMonitoringTrucks: { total: 0, items: [] } },
      });
      expect(await query(events, {}, selected)).toMatchObject({
        data: { fleetKarmaMonitoringEvents: { total: 0, items: [] } },
      });
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
