import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  KarmaDeviceReadsClient,
  type KarmaReadback,
} from '../src/integrations/karma/karma-device-reads.client.js';
import { DeviceOperationsProcessor } from '../src/modules/device-operations/device-operations.processor.js';
import { DeviceOperationsRepository } from '../src/modules/device-operations/device-operations.repository.js';
import { createTestDatabase } from './test-database.js';

const tenantId = randomUUID(),
  branchId = randomUUID();
const scope = { tenantId, branchId };
const fields =
  'id deviceId status requestedAt dispatchedAt completedAt observationCount configuration{configurationId parameters{parameterId intervalSeconds definitionHex}} errorCode';
const definition = '0296000000000000000000000000000000000000001E';
const otherDefinition = '00990000000000000000000000000000000000000000';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected object');
  }
  return value;
}

describe('Durable device configuration operations with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let module: TestingModule;
  let url = '';
  let now = new Date('2026-10-20T10:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const target = jest
    .fn<KarmaDeviceReadsClient['target']>()
    .mockImplementation((carId) => Promise.resolve({ carId, deviceId: 'upstream-device' }));
  const request = jest
    .fn<KarmaDeviceReadsClient['request']>()
    .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['91'] });
  const observations = jest.fn<KarmaDeviceReadsClient['observations']>();
  const originalEnabled = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;

  async function start() {
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(FleetClock)
      .useValue(clock)
      .overrideProvider(KarmaDeviceReadsClient)
      .useValue({ target, request, observations })
      // The tests advance individual leased steps explicitly instead of racing a real timer.
      .overrideProvider(DeviceOperationsProcessor)
      .useValue({ tick: () => Promise.resolve() })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  }
  beforeAll(async () => {
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'true';
    database = await createTestDatabase();
    closeDatabase = database.close;
    await start();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
      if (originalEnabled === undefined) {
        delete process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
      } else {
        process.env.FLEET_DEVICE_OPERATIONS_ENABLED = originalEnabled;
      }
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown>,
    branch = branchId,
    tenant = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenant)}`,
        'x-branch-id': branch,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const result: unknown = await response.json();
    return result;
  }
  async function device(imei: string) {
    return database.client.device.create({ data: { ...scope, imei } });
  }
  function worker() {
    return new DeviceOperationsProcessor(
      module.get(DeviceOperationsRepository),
      module.get(KarmaDeviceReadsClient),
      clock,
    );
  }
  async function advance() {
    const row = await module.get(DeviceOperationsRepository).claim(now);
    if (!row) {
      throw new Error('Expected a due operation');
    }
    await worker().process(row);
    return row;
  }

  it('recovers submitted reads and multipart evidence across application restarts and scoped GraphQL reloads', async () => {
    const selected = await device('000000000000801');
    const result = object(
      object(
        await query(
          `mutation($input:RequestFleetDeviceConfigurationReadInput!){requestFleetDeviceConfigurationRead(input:$input){${fields}}}`,
          {
            input: {
              deviceId: selected.id,
              karmaCarId: '801',
              expectedKarmaDeviceId: 'upstream-device',
            },
          },
        ),
      ).data,
    );
    const operation = object(result.requestFleetDeviceConfigurationRead);
    expect(operation.status).toBe('QUEUED');
    expect(request).not.toHaveBeenCalled();
    await advance();
    expect(request).toHaveBeenCalledTimes(1);
    const partOne: KarmaReadback = {
      coverageComplete: true,
      readback: { status: 'INCOMPLETE', configurationId: '1001', parameters: [] },
      observations: [
        {
          messageId: '2001',
          eventTimeUtc: now.toISOString(),
          rawMessage: `19,0,401,0,0,1,1001,07${definition}`,
          configurationId: '1001',
          messageNumber: 1,
          lastMessage: false,
          parameters: [
            { parameterId: 662, reportingIntervalSeconds: 30, rawDefinition: definition },
          ],
        },
      ],
    };
    observations.mockResolvedValueOnce(partOne);
    now = new Date(now.getTime() + 11_000);
    await advance();
    await app?.close();
    await start();
    const historyQuery = `query($deviceId:ID!){fleetDeviceOperations(deviceId:$deviceId){${fields}}}`;
    expect(await query(historyQuery, { deviceId: selected.id })).toMatchObject({
      data: {
        fleetDeviceOperations: [
          { id: operation.id, status: 'WAITING', observationCount: 1, configuration: null },
        ],
      },
    });
    expect(
      await query(
        `query($id:ID!){fleetDeviceOperation(id:$id){id}}`,
        { id: operation.id },
        randomUUID(),
      ),
    ).toEqual({ data: { fleetDeviceOperation: null } });
    expect(
      await query(
        `query($id:ID!){fleetDeviceOperation(id:$id){id}}`,
        { id: operation.id },
        branchId,
        randomUUID(),
      ),
    ).toEqual({ data: { fleetDeviceOperation: null } });
    now = new Date(now.getTime() + 11_000);
    // Only the second fragment remains upstream; the first must survive in our database.
    observations.mockResolvedValueOnce({
      coverageComplete: true,
      readback: { status: 'INCOMPLETE', configurationId: '1001', parameters: [] },
      observations: [
        {
          messageId: '2002',
          eventTimeUtc: now.toISOString(),
          rawMessage: `19,0,401,0,1,2,1001,07${otherDefinition}`,
          configurationId: '1001',
          messageNumber: 2,
          lastMessage: true,
          parameters: [
            { parameterId: 153, reportingIntervalSeconds: 0, rawDefinition: otherDefinition },
          ],
        },
      ],
    });
    await advance();
    expect(request).toHaveBeenCalledTimes(1);
    await app?.close();
    await start();
    expect(await query(historyQuery, { deviceId: selected.id })).toMatchObject({
      data: {
        fleetDeviceOperations: [
          {
            id: operation.id,
            status: 'COMPLETE',
            observationCount: 2,
            configuration: {
              configurationId: '1001',
              parameters: [
                { parameterId: 662, intervalSeconds: 30, definitionHex: definition },
                { parameterId: 153, intervalSeconds: 0, definitionHex: otherDefinition },
              ],
            },
          },
        ],
      },
    });
    await database.client.fleetDeviceOperation.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        ...scope,
        deviceId: selected.id,
        deviceImei: selected.imei,
        karmaCarId: '801',
        karmaDeviceId: 'upstream-device',
        status: 'TIMED_OUT',
        requestedAt: new Date(now.getTime() + index + 1),
        nextCheckAt: now,
        deadlineAt: new Date(now.getTime() + 600_000),
        completedAt: now,
      })),
    });
    expect(
      await query(
        `query($deviceId:ID!){fleetDeviceConfigurationSnapshot(deviceId:$deviceId){${fields}}}`,
        { deviceId: selected.id },
      ),
    ).toMatchObject({
      data: { fleetDeviceConfigurationSnapshot: { id: operation.id, status: 'COMPLETE' } },
    });
  });

  it('claims a row once, fences expired holders and reconciles a crash during submission without replay', async () => {
    const selected = await device('000000000000802');
    const repository = module.get(DeviceOperationsRepository);
    const operation = await repository.create(
      scope,
      {
        deviceId: selected.id,
        deviceImei: selected.imei,
        karmaCarId: '802',
        karmaDeviceId: 'upstream-device',
      },
      now,
    );
    const claims = await Promise.all([repository.claim(now), repository.claim(now)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const holder = claims.find((row) => row !== null);
    if (!holder) {
      throw new Error('Expected lease holder');
    }
    expect(
      await repository.save(holder, { status: 'SUBMITTING', dispatchedAt: now }, now, false),
    ).toBe(true);
    now = new Date(now.getTime() + 31_000);
    const recovered = await repository.claim(now);
    if (!recovered) {
      throw new Error('Expected an expired lease to be recoverable');
    }
    expect(await repository.save(holder, { status: 'FAILED' }, now)).toBe(false);
    const requestsBefore = request.mock.calls.length;
    await worker().process(recovered);
    expect(request.mock.calls.length).toBe(requestsBefore);
    expect(await repository.find(scope, operation.id)).toMatchObject({
      status: 'UNKNOWN',
      errorCode: 'SUBMISSION_UNCERTAIN',
      leaseToken: null,
    });
    now = new Date(operation.deadlineAt.getTime() + 1);
    await advance();
    expect(await repository.find(scope, operation.id)).toMatchObject({
      status: 'TIMED_OUT',
      errorCode: 'READ_TIMEOUT',
    });
  });

  it('enforces scoped device references, one active target, lease consistency and complete-result invariants', async () => {
    const selected = await device('000000000000803');
    const repository = module.get(DeviceOperationsRepository);
    const targetData = {
      deviceId: selected.id,
      deviceImei: selected.imei,
      karmaCarId: '803',
      karmaDeviceId: 'upstream-device',
    };
    const operation = await repository.create(scope, targetData, now);
    await expect(repository.create(scope, targetData, now)).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(
      repository.create(
        { tenantId: randomUUID(), branchId },
        { ...targetData, karmaCarId: '804' },
        now,
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      database.client.fleetDeviceOperation.update({
        where: { id: operation.id },
        data: { leaseToken: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      database.client.fleetDeviceOperation.update({
        where: { id: operation.id },
        data: { status: 'COMPLETE', completedAt: now },
      }),
    ).rejects.toThrow();
    await database.client.device.update({
      where: { id: selected.id },
      data: { imei: '000000000000804' },
    });
    await advance();
    expect(await repository.find(scope, operation.id)).toMatchObject({
      status: 'FAILED',
      errorCode: 'LOCAL_DEVICE_CHANGED',
    });
    expect(
      await query(
        `query($deviceId:ID!){fleetDeviceOperations(deviceId:$deviceId){id}}`,
        { deviceId: selected.id },
        randomUUID(),
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
  });
});
