import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import {
  KarmaDeviceReadsClient,
  type KarmaReadback,
} from '../../integrations/karma/karma-device-reads.client.js';
import { DeviceOperationsProcessor } from './device-operations.processor.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';
import { changedDefinition } from './device-parameter-change.js';

const raw = 'FDE8ABCDEF1234561234567890ABCDEF123456780025';
const baseline = [{ parameterId: 65000, intervalSeconds: 37, definitionHex: raw }];
const now = new Date('2026-10-21T10:00:00.000Z');

function row(): DeviceOperationRow {
  return {
    id: randomUUID(),
    tenantId: randomUUID(),
    branchId: randomUUID(),
    deviceId: randomUUID(),
    deviceImei: '001234567890123',
    karmaCarId: '41',
    karmaDeviceId: 'upstream',
    status: 'QUEUED',
    kind: 'UPDATE_INTERVAL',
    phase: 'READ_PARAMETERS',
    baselineOperationId: randomUUID(),
    parameterId: 65000,
    intervalSeconds: 0,
    previousIntervalSeconds: 37,
    catalogId: null,
    profileId: null,
    profileReadAt: null,
    profileObservations: [],
    baselineConfiguration: baseline,
    baselineConfigurationId: '7',
    baselineObservations: [],
    baselineReadAt: null,
    definitionHex: null,
    readAfterMessageId: '90',
    phaseDispatchedAt: null,
    writeDispatchedAt: null,
    writeQueueIds: [],
    writeUncertain: false,
    requestedAt: now,
    dispatchedAt: now,
    completedAt: null,
    nextCheckAt: now,
    deadlineAt: new Date(now.getTime() + 600_000),
    leaseToken: randomUUID(),
    leaseUntil: new Date(now.getTime() + 30_000),
    queueIds: [],
    observations: [],
    configuration: null,
    configurationId: null,
    errorCode: null,
    attempts: 1,
    updatedAt: now,
  };
}

function reply(definition: string, messageId = '100'): KarmaReadback {
  return {
    coverageComplete: true,
    readback: { status: 'COMPLETE', configurationId: '8', parameters: [] },
    observations: [
      {
        messageId,
        eventTimeUtc: now.toISOString(),
        rawMessage: `19,0,401,0,1,1,8,07${definition}`,
        configurationId: '8',
        messageNumber: 1,
        lastMessage: true,
        parameters: [
          {
            parameterId: 65000,
            reportingIntervalSeconds: Number.parseInt(definition.slice(40), 16),
            rawDefinition: definition,
          },
        ],
      },
    ],
  };
}

describe('Durable single-definition write phases', () => {
  const save = jest.fn<DeviceOperationsRepository['save']>();
  const currentDevice = jest.fn<DeviceOperationsRepository['currentDevice']>();
  const presets = jest.fn<DeviceOperationsRepository['presets']>();
  const request = jest.fn<KarmaDeviceReadsClient['request']>();
  const requestParameter = jest.fn<KarmaDeviceReadsClient['requestParameter']>();
  const observations = jest.fn<KarmaDeviceReadsClient['observations']>();
  const profileObservations = jest.fn<KarmaDeviceReadsClient['profileObservations']>();
  const env = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;
  const readsEnv = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  let processor: DeviceOperationsProcessor;
  let clockNow = now;
  beforeEach(async () => {
    jest.resetAllMocks();
    clockNow = now;
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'true';
    process.env.FLEET_DEVICE_OPERATIONS_ENABLED = 'true';
    const module = await Test.createTestingModule({
      providers: [
        DeviceOperationsProcessor,
        { provide: DeviceOperationsRepository, useValue: { save, currentDevice, presets } },
        {
          provide: KarmaDeviceReadsClient,
          useValue: { request, requestParameter, observations, profileObservations },
        },
        { provide: FleetClock, useValue: { now: () => clockNow } },
      ],
    }).compile();
    processor = module.get(DeviceOperationsProcessor);
    save.mockResolvedValue(true);
    currentDevice.mockResolvedValue(true);
    request.mockResolvedValue({ status: 'ACCEPTED', queueIds: ['8'] });
    requestParameter.mockResolvedValue({ status: 'ACCEPTED', queueIds: ['9'] });
  });
  afterEach(() => {
    if (env === undefined) {
      delete process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;
    } else {
      process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = env;
    }
    if (readsEnv === undefined) {
      delete process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
    } else {
      process.env.FLEET_DEVICE_OPERATIONS_ENABLED = readsEnv;
    }
  });

  it('re-reads the confirmed baseline, builds only an interval replacement and captures evidence', async () => {
    const operation = {
      ...row(),
      status: 'WAITING',
      phaseDispatchedAt: now,
    } satisfies DeviceOperationRow;
    observations.mockResolvedValue(reply(raw));
    await processor.process(operation);
    expect(observations).toHaveBeenCalledWith('41', 'upstream', now, now, '90');
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        phase: 'WRITE_PARAMETER',
        status: 'QUEUED',
        definitionHex: changedDefinition(raw, 0),
        baselineReadAt: now,
        readAfterMessageId: '100',
      }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('rejects a baseline changed since the operator confirmed it', async () => {
    const operation = { ...row(), status: 'WAITING' } satisfies DeviceOperationRow;
    observations.mockResolvedValue(reply(changedDefinition(raw, 10)));
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({ status: 'FAILED', errorCode: 'BASELINE_CHANGED' }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('durably marks the sole write before sending and switches to an independent read', async () => {
    const operation = {
      ...row(),
      phase: 'WRITE_PARAMETER',
      baselineReadAt: now,
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    await processor.process(operation);
    expect(save).toHaveBeenNthCalledWith(
      1,
      operation,
      { status: 'SUBMITTING', writeDispatchedAt: now },
      now,
      false,
    );
    expect(requestParameter).toHaveBeenCalledWith(
      '41',
      'upstream',
      65000,
      0,
      changedDefinition(raw, 0),
    );
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        phase: 'VERIFY_PARAMETERS',
        status: 'QUEUED',
        writeQueueIds: ['9'],
        writeUncertain: false,
      }),
      now,
    );
  });

  it('never replays a crash-ambiguous write and still verifies after writes are disabled', async () => {
    const operation = {
      ...row(),
      phase: 'WRITE_PARAMETER',
      status: 'SUBMITTING',
      writeDispatchedAt: now,
      baselineReadAt: now,
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'false';
    await processor.process(operation);
    expect(requestParameter).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        phase: 'VERIFY_PARAMETERS',
        status: 'QUEUED',
        writeUncertain: true,
      }),
      now,
    );
  });

  it('keeps an old unchanged read unconfirmed and retries only a safe read with an advanced watermark', async () => {
    const operation = {
      ...row(),
      phase: 'VERIFY_PARAMETERS',
      status: 'WAITING',
      writeDispatchedAt: now,
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    observations.mockResolvedValue(reply(raw, '200'));
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        status: 'QUEUED',
        phaseDispatchedAt: null,
        readAfterMessageId: '200',
        observations: [],
        errorCode: 'WRITE_NOT_OBSERVED',
      }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('publishes a complete result only after full independent verification', async () => {
    const operation = {
      ...row(),
      phase: 'VERIFY_PARAMETERS',
      status: 'WAITING',
      writeDispatchedAt: now,
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    observations.mockResolvedValue(reply(changedDefinition(raw, 0), '201'));
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        status: 'COMPLETE',
        configuration: [
          { parameterId: 65000, intervalSeconds: 0, definitionHex: changedDefinition(raw, 0) },
        ],
      }),
      now,
    );
  });

  it('blocks a removed feature flag before the durable send marker and refreshes stale preflight', async () => {
    const operation = {
      ...row(),
      phase: 'WRITE_PARAMETER',
      baselineReadAt: new Date(now.getTime() - 121_000),
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        phase: 'READ_PARAMETERS',
        status: 'QUEUED',
        errorCode: 'BASELINE_EXPIRED',
      }),
      now,
    );
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'false';
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({ status: 'FAILED', errorCode: 'WRITE_DISABLED' }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('requires a freshly read profile to contain the addition in the selected verified catalog', async () => {
    const operation = {
      ...row(),
      kind: 'ADD_PARAMETER',
      phase: 'READ_PROFILE',
      status: 'WAITING',
      catalogId: randomUUID(),
      parameterId: 781,
    } satisfies DeviceOperationRow;
    profileObservations.mockResolvedValue({
      coverageComplete: true,
      readback: { status: 'COMPLETE', profileId: 430 },
      observations: [
        {
          messageId: '95',
          eventTimeUtc: now.toISOString(),
          rawMessage: '19,0,416,0,1,1,8,1F01AE',
          configurationId: '8',
          messageNumber: 1,
          lastMessage: true,
          profileId: 430,
        },
      ],
    });
    presets.mockResolvedValue([
      {
        catalogId: operation.catalogId,
        catalogLabel: '9.56',
        parameterId: 781,
        name: 'Voltage',
        profileIds: [343],
      },
    ]);
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({ status: 'FAILED', errorCode: 'PROFILE_UNSUPPORTED' }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('does not relabel a five-minute-old complete baseline as fresh after restart', async () => {
    const operation = {
      ...row(),
      status: 'WAITING',
      requestedAt: new Date(now.getTime() - 300_000),
      phaseDispatchedAt: new Date(now.getTime() - 300_000),
    } satisfies DeviceOperationRow;
    observations.mockResolvedValue(reply(raw));
    await processor.process(operation);
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        status: 'QUEUED',
        phaseDispatchedAt: null,
        observations: [],
        readAfterMessageId: '100',
        errorCode: 'BASELINE_EXPIRED',
        baselineReadAt: operation.phaseDispatchedAt,
      }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('refreshes an old complete profile using its own watermark without borrowing parameter IDs', async () => {
    const operation = {
      ...row(),
      kind: 'ADD_PARAMETER',
      phase: 'READ_PROFILE',
      status: 'WAITING',
      catalogId: randomUUID(),
      parameterId: 781,
      requestedAt: new Date(now.getTime() - 300_000),
      phaseDispatchedAt: new Date(now.getTime() - 300_000),
    } satisfies DeviceOperationRow;
    profileObservations.mockResolvedValue({
      coverageComplete: true,
      readback: { status: 'COMPLETE', profileId: 343 },
      observations: [
        {
          messageId: '95',
          eventTimeUtc: now.toISOString(),
          rawMessage: '19,0,416,0,1,1,8,1F0157',
          configurationId: '8',
          messageNumber: 1,
          lastMessage: true,
          profileId: 343,
        },
      ],
    });
    await processor.process(operation);
    expect(profileObservations).toHaveBeenCalledWith(
      '41',
      'upstream',
      operation.phaseDispatchedAt,
      now,
      undefined,
    );
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        status: 'QUEUED',
        phaseDispatchedAt: null,
        profileObservations: { afterMessageId: '95', items: [], count: 0, coverageComplete: false },
        errorCode: 'PROFILE_EXPIRED',
      }),
      now,
    );
    expect(requestParameter).not.toHaveBeenCalled();
  });

  it('sends no write when returning from the durable marker leaves too little lease budget', async () => {
    const operation = {
      ...row(),
      phase: 'WRITE_PARAMETER',
      baselineReadAt: now,
      definitionHex: changedDefinition(raw, 0),
    } satisfies DeviceOperationRow;
    save.mockImplementationOnce(() => {
      clockNow = new Date(now.getTime() + 26_000);
      return Promise.resolve(true);
    });
    await processor.process(operation);
    expect(requestParameter).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith(
      operation,
      expect.objectContaining({
        phase: 'VERIFY_PARAMETERS',
        status: 'QUEUED',
        writeUncertain: true,
      }),
      clockNow,
    );
  });
});
