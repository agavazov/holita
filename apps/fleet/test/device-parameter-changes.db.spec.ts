import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  KarmaDeviceReadsClient,
  type KarmaReadback,
} from '../src/integrations/karma/karma-device-reads.client.js';
import { changedDefinition } from '../src/modules/device-operations/device-parameter-change.js';
import { DeviceOperationsProcessor } from '../src/modules/device-operations/device-operations.processor.js';
import {
  DeviceOperationsRepository,
  MONITOR_SOURCE_SHA256,
} from '../src/modules/device-operations/device-operations.repository.js';
import { createTestDatabase } from './test-database.js';

const scope = { tenantId: randomUUID(), branchId: randomUUID() };
const raw = 'FDE8ABCDEF1234561234567890ABCDEF123456780025';
const other = '0296000000000000000000000000000000000000001E';
const otherParameter = { parameterId: 662, intervalSeconds: 30, definitionHex: other };
const baselineConfiguration = [
  { parameterId: 65000, intervalSeconds: 37, definitionHex: raw },
  otherParameter,
];

describe('Durable reporting changes with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let module: TestingModule | undefined;
  let repository: DeviceOperationsRepository;
  let processor: DeviceOperationsProcessor;
  let now = new Date('2026-10-21T10:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const reads = jest
    .fn<KarmaDeviceReadsClient['request']>()
    .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['21'] });
  const writes = jest
    .fn<KarmaDeviceReadsClient['requestParameter']>()
    .mockResolvedValue({ status: 'UNCERTAIN', queueIds: [] });
  const observations = jest.fn<KarmaDeviceReadsClient['observations']>();
  const originalReadFlag = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  const originalWriteFlag = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;

  async function start() {
    module = await Test.createTestingModule({
      providers: [
        DeviceOperationsRepository,
        DeviceOperationsProcessor,
        { provide: PrismaService, useValue: { client: database.client } },
        { provide: FleetClock, useValue: clock },
        {
          provide: KarmaDeviceReadsClient,
          useValue: { request: reads, requestParameter: writes, observations },
        },
      ],
    }).compile();
    repository = module.get(DeviceOperationsRepository);
    processor = module.get(DeviceOperationsProcessor);
  }
  beforeAll(async () => {
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'true';
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'true';
    database = await createTestDatabase();
    closeDatabase = database.close;
    await start();
  });
  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      await closeDatabase?.();
      if (originalReadFlag === undefined) {
        delete process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
      } else {
        process.env.FLEET_DEVICE_OPERATIONS_ENABLED = originalReadFlag;
      }
      if (originalWriteFlag === undefined) {
        delete process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;
      } else {
        process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = originalWriteFlag;
      }
    }
  });
  async function baseline(carId: string) {
    const selected = await database.client.device.create({
      data: { ...scope, imei: carId.padStart(15, '0') },
    });
    return database.client.fleetDeviceOperation.create({
      data: {
        ...scope,
        deviceId: selected.id,
        deviceImei: selected.imei,
        karmaCarId: carId,
        karmaDeviceId: 'opaque-device',
        status: 'COMPLETE',
        requestedAt: now,
        dispatchedAt: now,
        completedAt: now,
        nextCheckAt: now,
        deadlineAt: new Date(now.getTime() + 600_000),
        configurationId: '7',
        configuration: baselineConfiguration,
      },
    });
  }
  function reply(
    parameters: typeof baselineConfiguration,
    messageId: string,
    number = 1,
    last = true,
  ): KarmaReadback {
    return {
      coverageComplete: true,
      readback: { status: last ? 'COMPLETE' : 'INCOMPLETE', configurationId: '8', parameters: [] },
      observations: [
        {
          messageId,
          eventTimeUtc: now.toISOString(),
          rawMessage: `19,0,401,0,${last ? '1' : '0'},${String(number)},8,07${parameters.map((item) => item.definitionHex).join('')}`,
          configurationId: '8',
          messageNumber: number,
          lastMessage: last,
          parameters: parameters.map((item) => ({
            parameterId: item.parameterId,
            reportingIntervalSeconds: item.intervalSeconds,
            rawDefinition: item.definitionHex,
          })),
        },
      ],
    };
  }
  async function advance() {
    now = new Date(now.getTime() + 11_000);
    const claimed = await repository.claim(now);
    if (!claimed) {
      throw new Error('Expected due operation');
    }
    await processor.process(claimed);
    return repository.find(scope, claimed.id);
  }

  it('persists the exact unknown baseline, sends once and verifies split evidence across restart with writes disabled', async () => {
    const confirmed = await baseline('9101');
    const operation = await repository.createWrite(
      scope,
      confirmed,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: confirmed.id,
        parameterId: 65000,
        intervalSeconds: 0,
        catalogId: null,
      },
      now,
    );
    expect(operation.baselineConfiguration).toEqual(baselineConfiguration);
    expect(operation.previousIntervalSeconds).toBe(37);
    await advance(); // Safe preflight read.
    observations.mockResolvedValueOnce(reply(baselineConfiguration, '101'));
    const ready = await advance();
    expect(ready).toMatchObject({
      phase: 'WRITE_PARAMETER',
      status: 'QUEUED',
      definitionHex: changedDefinition(raw, 0),
      readAfterMessageId: '101',
    });
    const sent = await advance();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes).toHaveBeenLastCalledWith(
      '9101',
      'opaque-device',
      65000,
      0,
      changedDefinition(raw, 0),
    );
    expect(sent).toMatchObject({
      phase: 'VERIFY_PARAMETERS',
      status: 'QUEUED',
      writeUncertain: true,
    });
    expect(sent?.writeDispatchedAt).not.toBeNull();
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'false';
    await module?.close();
    await start();
    await advance(); // Independent post-write read remains allowed.
    observations.mockResolvedValueOnce(reply([otherParameter], '102', 1, false));
    expect(await advance()).toMatchObject({ status: 'WAITING', observations: { count: 1 } });
    await module?.close();
    await start();
    const changed = {
      parameterId: 65000,
      intervalSeconds: 0,
      definitionHex: changedDefinition(raw, 0),
    };
    observations.mockResolvedValueOnce(reply([changed], '103', 2, true));
    const completed = await advance();
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      phase: 'VERIFY_PARAMETERS',
      observations: { count: 2 },
    });
    expect(completed?.configuration).toEqual([baselineConfiguration[1], changed]);
    expect(completed?.baselineConfiguration).toEqual(baselineConfiguration);
    expect(writes).toHaveBeenCalledTimes(1);
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'true';
  });

  it('recovers an expired lease after the write marker without replaying the ambiguous command', async () => {
    const previousWrites = writes.mock.calls.length;
    const confirmed = await baseline('9102');
    const operation = await repository.createWrite(
      scope,
      confirmed,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: confirmed.id,
        parameterId: 65000,
        intervalSeconds: 0,
        catalogId: null,
      },
      now,
    );
    await database.client.fleetDeviceOperation.update({
      where: { id: operation.id },
      data: {
        phase: 'WRITE_PARAMETER',
        status: 'SUBMITTING',
        baselineReadAt: now,
        dispatchedAt: now,
        definitionHex: changedDefinition(raw, 0),
        writeDispatchedAt: now,
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() + 30_000),
      },
    });
    await module?.close();
    await start();
    now = new Date(now.getTime() + 31_000);
    const recovered = await advance();
    expect(recovered).toMatchObject({
      phase: 'VERIFY_PARAMETERS',
      status: 'QUEUED',
      writeUncertain: true,
    });
    expect(writes).toHaveBeenCalledTimes(previousWrites);
    await database.client.fleetDeviceOperation.update({
      where: { id: operation.id },
      data: { status: 'TIMED_OUT', completedAt: now },
    });
  });

  it('keeps the global target lock across kinds and rejects a cross-Branch baseline FK', async () => {
    const confirmed = await baseline('9103');
    const operation = await repository.createWrite(
      scope,
      confirmed,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: confirmed.id,
        parameterId: 65000,
        intervalSeconds: 0,
        catalogId: null,
      },
      now,
    );
    await expect(
      repository.create(
        scope,
        {
          deviceId: confirmed.deviceId,
          deviceImei: confirmed.deviceImei,
          karmaCarId: confirmed.karmaCarId,
          karmaDeviceId: confirmed.karmaDeviceId,
        },
        now,
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
    const otherScope = { tenantId: scope.tenantId, branchId: randomUUID() };
    const selected = await database.client.device.create({
      data: { ...otherScope, imei: '000000000009104' },
    });
    await expect(
      database.client.fleetDeviceOperation.create({
        data: {
          ...otherScope,
          deviceId: selected.id,
          deviceImei: selected.imei,
          karmaCarId: '9104',
          karmaDeviceId: 'opaque',
          kind: 'UPDATE_INTERVAL',
          baselineOperationId: confirmed.id,
          parameterId: 65000,
          intervalSeconds: 0,
          baselineConfiguration,
          baselineConfigurationId: '7',
          requestedAt: now,
          nextCheckAt: now,
          deadlineAt: new Date(now.getTime() + 600_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await database.client.fleetDeviceOperation.update({
      where: { id: operation.id },
      data: { status: 'TIMED_OUT', completedAt: now },
    });
  });

  it('offers only verified-source unambiguous Monitor IDs with actual profile membership', async () => {
    async function catalog(sha: string, label: string) {
      const item = await database.client.edataCatalog.create({
        data: {
          sourceSha256: sha,
          extractorVersion: '1.0.0',
          schemaVersion: 1,
          packageLabel: label,
          contentSha256: 'b'.repeat(64),
          metadata: {},
        },
      });
      await database.client.edataCatalogSource.create({
        data: { catalogId: item.id, key: 'monitor', kind: 'monitor', evidence: {} },
      });
      await database.client.edataCatalogParameter.createMany({
        data: [
          {
            catalogId: item.id,
            key: 'monitor:1',
            sourceKey: 'monitor',
            parameterId: 900,
            category: '1',
            name: 'Other predefined signal',
            details: { issues: [] },
          },
          {
            catalogId: item.id,
            key: 'monitor:2',
            sourceKey: 'monitor',
            parameterId: 901,
            category: '1',
            name: 'Ambiguous one',
            details: { issues: [] },
          },
          {
            catalogId: item.id,
            key: 'monitor:3',
            sourceKey: 'monitor',
            parameterId: 901,
            category: '2',
            name: 'Ambiguous two',
            details: { issues: [] },
          },
          {
            catalogId: item.id,
            key: 'monitor:4',
            sourceKey: 'monitor',
            parameterId: 902,
            category: '1',
            name: 'No profile membership',
            details: { issues: [] },
          },
        ],
      });
      await database.client.edataCatalogCategory.create({
        data: { catalogId: item.id, vendorId: 3, name: 'FMS' },
      });
      await database.client.edataCatalogSet.create({
        data: { catalogId: item.id, vendorId: 135, details: {} },
      });
      await database.client.edataCatalogSetMember.createMany({
        data: [900, 901].map((parameterId, position) => ({
          catalogId: item.id,
          setId: 135,
          position,
          parameterId,
        })),
      });
      await database.client.edataCatalogProfile.create({
        data: { catalogId: item.id, vendorId: 430, categoryId: 3, setId: 135, name: 'FMS500' },
      });
      return item;
    }
    await catalog('a'.repeat(64), 'Unverified');
    const verified = await catalog(MONITOR_SOURCE_SHA256, 'Monitor9.56');
    expect(await repository.presets()).toEqual([
      {
        catalogId: verified.id,
        catalogLabel: 'Monitor9.56',
        parameterId: 900,
        name: 'Other predefined signal',
        profileIds: [430],
      },
    ]);
  });
});
