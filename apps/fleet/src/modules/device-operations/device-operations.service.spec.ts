import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaDeviceReadsClient } from '../../integrations/karma/karma-device-reads.client.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';
import { deviceOperationResult, DeviceOperationsService } from './device-operations.service.js';
import { monitorDefinition } from './device-parameter-change.js';

describe('Durable device configuration reads', () => {
  const find = jest.fn<DeviceOperationsRepository['find']>();
  const history = jest.fn<DeviceOperationsRepository['history']>();
  const lastComplete = jest.fn<DeviceOperationsRepository['lastComplete']>();
  const findDevice = jest.fn<DeviceOperationsRepository['findDevice']>();
  const create = jest.fn<DeviceOperationsRepository['create']>();
  const createWrite = jest.fn<DeviceOperationsRepository['createWrite']>();
  const presets = jest.fn<DeviceOperationsRepository['presets']>();
  const target = jest.fn<KarmaDeviceReadsClient['target']>();
  const now = new Date('2026-10-20T10:00:00.000Z');
  const context = {
    tenantId: randomUUID(),
    branchId: randomUUID(),
    requestId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  } satisfies RequestContext;
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const deviceId = randomUUID();
  const input = { deviceId, karmaCarId: '41', expectedKarmaDeviceId: 'upstream-opaque-id' };
  const env = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  const writesEnv = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;
  let service: DeviceOperationsService;

  function row(): DeviceOperationRow {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      branchId: context.branchId,
      deviceId,
      deviceImei: '001234567890123',
      karmaCarId: '41',
      karmaDeviceId: 'upstream-opaque-id',
      status: 'QUEUED',
      kind: 'READ_CONFIGURATION',
      phase: 'READ_PARAMETERS',
      baselineOperationId: null,
      parameterId: null,
      intervalSeconds: null,
      previousIntervalSeconds: null,
      catalogId: null,
      profileId: null,
      profileReadAt: null,
      profileObservations: [],
      baselineConfiguration: null,
      baselineConfigurationId: null,
      baselineObservations: [],
      baselineReadAt: null,
      definitionHex: null,
      readAfterMessageId: null,
      phaseDispatchedAt: null,
      writeDispatchedAt: null,
      writeQueueIds: [],
      writeUncertain: false,
      requestedAt: now,
      dispatchedAt: null,
      completedAt: null,
      nextCheckAt: now,
      deadlineAt: new Date(now.getTime() + 600_000),
      leaseToken: null,
      leaseUntil: null,
      queueIds: [],
      observations: [],
      configuration: null,
      configurationId: null,
      errorCode: null,
      attempts: 0,
      updatedAt: now,
    };
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'true';
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'true';
    const module = await Test.createTestingModule({
      providers: [
        DeviceOperationsService,
        {
          provide: DeviceOperationsRepository,
          useValue: { find, history, lastComplete, findDevice, create, createWrite, presets },
        },
        { provide: KarmaDeviceReadsClient, useValue: { target } },
        { provide: FleetClock, useValue: { now: () => now } },
      ],
    }).compile();
    service = module.get(DeviceOperationsService);
    findDevice.mockResolvedValue({ id: deviceId, imei: '001234567890123' });
    target.mockResolvedValue({ carId: '41', deviceId: 'upstream-opaque-id' });
    create.mockResolvedValue(row());
    createWrite.mockResolvedValue({ ...row(), kind: 'UPDATE_INTERVAL' });
  });

  afterEach(() => {
    if (writesEnv === undefined) {
      delete process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;
    } else {
      process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = writesEnv;
    }
    if (env === undefined) {
      delete process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
    } else {
      process.env.FLEET_DEVICE_OPERATIONS_ENABLED = env;
    }
  });

  it('binds interval edits to a scoped complete baseline and preserves unknown definitions', async () => {
    const baseline = {
      ...row(),
      status: 'COMPLETE',
      configurationId: '7',
      configuration: [
        {
          parameterId: 65000,
          intervalSeconds: 37,
          definitionHex: 'FDE8ABCDEF1234561234567890ABCDEF123456780025',
        },
      ],
    } satisfies DeviceOperationRow;
    find.mockResolvedValue(baseline);
    await service.requestIntervalUpdate(context, {
      ...input,
      baselineOperationId: baseline.id,
      parameterId: 65000,
      intervalSeconds: 0,
    });
    expect(find).toHaveBeenCalledWith(scope, baseline.id);
    expect(createWrite).toHaveBeenCalledWith(
      scope,
      baseline,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: baseline.id,
        parameterId: 65000,
        intervalSeconds: 0,
        catalogId: null,
      },
      now,
    );
  });

  it('rejects a baseline for another device/target and disabled writes before any command', async () => {
    const write = {
      ...input,
      baselineOperationId: randomUUID(),
      parameterId: 781,
      intervalSeconds: 60,
    };
    find.mockResolvedValue({
      ...row(),
      status: 'COMPLETE',
      configurationId: '7',
      karmaDeviceId: 'different',
    });
    await expect(service.requestIntervalUpdate(context, write)).rejects.toThrow(ConflictException);
    expect(target).not.toHaveBeenCalled();
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'false';
    await expect(service.requestIntervalUpdate(context, write)).rejects.toThrow('disabled');
    expect(createWrite).not.toHaveBeenCalled();
  });

  it('offers additions only from eligible catalog presets and rejects an existing ID', async () => {
    const catalogId = randomUUID();
    const baseline = {
      ...row(),
      status: 'COMPLETE',
      configurationId: '7',
      configuration: [],
    } satisfies DeviceOperationRow;
    find.mockResolvedValue(baseline);
    presets.mockResolvedValue([
      { catalogId, catalogLabel: '9.56', parameterId: 781, name: 'Voltage', profileIds: [343] },
    ]);
    const addition = {
      ...input,
      baselineOperationId: baseline.id,
      catalogId,
      parameterId: 781,
      intervalSeconds: 65000,
    };
    await service.requestAddition(context, addition);
    expect(createWrite).toHaveBeenCalledWith(
      scope,
      baseline,
      expect.objectContaining({ kind: 'ADD_PARAMETER', catalogId, parameterId: 781 }),
      now,
    );
    presets.mockResolvedValue([]);
    await expect(service.requestAddition(context, addition)).rejects.toMatchObject({
      response: {
        message: 'Choose an unambiguous predefined Monitor catalog parameter.',
        fieldErrors: [
          {
            path: 'parameterId',
            message: 'Choose an unambiguous predefined Monitor catalog parameter.',
            code: 'CATALOG_PARAMETER_UNSUPPORTED',
          },
        ],
      },
    });
  });

  it('rejects an addition at the complete readback capacity before contacting Karma', async () => {
    const baseline = {
      ...row(),
      status: 'COMPLETE',
      configurationId: '7',
      configuration: Array.from({ length: 1000 }, (_, parameterId) => ({
        parameterId,
        intervalSeconds: 0,
        definitionHex: monitorDefinition(parameterId, 0),
      })),
    } satisfies DeviceOperationRow;
    find.mockResolvedValue(baseline);
    await expect(
      service.requestAddition(context, {
        ...input,
        baselineOperationId: baseline.id,
        catalogId: randomUUID(),
        parameterId: 2000,
        intervalSeconds: 60,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'The configuration has reached the supported readback capacity.',
        fieldErrors: [
          {
            path: 'parameterId',
            message: 'The configuration has reached the supported readback capacity.',
            code: 'CONFIGURATION_CAPACITY',
          },
        ],
      },
    });
    expect(target).not.toHaveBeenCalled();
    expect(createWrite).not.toHaveBeenCalled();
  });

  it('persists the verified scope and explicitly chosen target without inferring IMEI equality', async () => {
    await expect(service.request(context, input)).resolves.toMatchObject({
      status: 'QUEUED',
      deviceImei: '001234567890123',
      karmaDeviceId: 'upstream-opaque-id',
    });
    expect(findDevice).toHaveBeenCalledWith(scope, deviceId);
    expect(target).toHaveBeenCalledWith('41');
    expect(create).toHaveBeenCalledWith(
      scope,
      {
        deviceId,
        deviceImei: '001234567890123',
        karmaCarId: '41',
        karmaDeviceId: 'upstream-opaque-id',
      },
      now,
    );
  });

  it('rejects missing verified scope, disabled reads and a changed upstream identity before persistence', async () => {
    await expect(service.request({ ...context, tenantId: undefined }, input)).rejects.toThrow(
      'Sign in',
    );
    expect(target).not.toHaveBeenCalled();
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'false';
    await expect(service.request(context, input)).rejects.toThrow('disabled');
    expect(findDevice).not.toHaveBeenCalled();
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'true';
    target.mockResolvedValue({ carId: '41', deviceId: 'changed-target' });
    await expect(service.request(context, input)).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '41x', '9007199254740992'])(
    'rejects unsafe target %s without upstream access',
    async (karmaCarId) => {
      await expect(service.request(context, { ...input, karmaCarId })).rejects.toThrow(
        'Karma car ID',
      );
      expect(target).not.toHaveBeenCalled();
    },
  );

  it('does not contact Karma for another scope or missing local device', async () => {
    findDevice.mockResolvedValue(null);
    await expect(service.request(context, input)).rejects.toThrow(NotFoundException);
    expect(target).not.toHaveBeenCalled();
  });

  it('reads durable history in its verified scope even while new reads are disabled', async () => {
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'false';
    const stored = row();
    find.mockResolvedValue(stored);
    history.mockResolvedValue([stored]);
    await expect(service.find(context, stored.id)).resolves.toMatchObject({ id: stored.id });
    await expect(service.history(context, deviceId)).resolves.toHaveLength(1);
    expect(find).toHaveBeenCalledWith(scope, stored.id);
    expect(history).toHaveBeenCalledWith(scope, deviceId);
    expect(target).not.toHaveBeenCalled();
  });

  it('loads the last complete snapshot independently of recent history and current local identity', async () => {
    const completed = {
      ...row(),
      status: 'COMPLETE',
      completedAt: now,
      dispatchedAt: now,
      configurationId: '7',
      configuration: [],
    } satisfies DeviceOperationRow;
    lastComplete.mockResolvedValue(completed);
    await expect(service.snapshot(context, deviceId)).resolves.toMatchObject({
      id: completed.id,
      configuration: { configurationId: '7', parameters: [] },
    });
    expect(lastComplete).toHaveBeenCalledWith(scope, deviceId, '001234567890123');
    expect(history).not.toHaveBeenCalled();
    findDevice.mockResolvedValue(null);
    await expect(service.snapshot(context, deviceId)).rejects.toThrow(NotFoundException);
  });

  it('exposes configuration only from complete readback, preserving a zero interval', () => {
    const stored = {
      ...row(),
      configurationId: '01',
      configuration: [
        { parameterId: 662, intervalSeconds: 0, definitionHex: '0296' + '0'.repeat(40) },
      ],
      observations: { count: 2, coverageComplete: true },
    };
    expect(deviceOperationResult(stored).configuration).toBeNull();
    expect(
      deviceOperationResult({ ...stored, status: 'COMPLETE' }).configuration?.parameters[0]
        ?.intervalSeconds,
    ).toBe(0);
    expect(deviceOperationResult({ ...stored, status: 'COMPLETE' }).observationCount).toBe(2);
  });
});
