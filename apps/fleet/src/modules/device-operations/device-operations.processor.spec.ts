import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import {
  KarmaDeviceReadError,
  KarmaDeviceReadsClient,
  type KarmaReadback,
} from '../../integrations/karma/karma-device-reads.client.js';
import { DeviceOperationsProcessor } from './device-operations.processor.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';

describe('Device read worker recovery and evidence', () => {
  const claim = jest.fn<DeviceOperationsRepository['claim']>();
  const save = jest.fn<DeviceOperationsRepository['save']>();
  const currentDevice = jest.fn<DeviceOperationsRepository['currentDevice']>();
  const request = jest.fn<KarmaDeviceReadsClient['request']>();
  const observations = jest.fn<KarmaDeviceReadsClient['observations']>();
  const now = new Date('2026-10-20T10:00:00.000Z');
  let clockNow = now;
  let processor: DeviceOperationsProcessor;
  function row(status: DeviceOperationRow['status'] = 'QUEUED'): DeviceOperationRow {
    return {
      id: randomUUID(),
      tenantId: randomUUID(),
      branchId: randomUUID(),
      deviceId: randomUUID(),
      deviceImei: '001234567890123',
      karmaCarId: '41',
      karmaDeviceId: 'upstream-id',
      status,
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
      dispatchedAt: status === 'QUEUED' ? null : now,
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

  beforeEach(async () => {
    jest.resetAllMocks();
    clockNow = now;
    const module = await Test.createTestingModule({
      providers: [
        DeviceOperationsProcessor,
        { provide: DeviceOperationsRepository, useValue: { claim, save, currentDevice } },
        { provide: KarmaDeviceReadsClient, useValue: { request, observations } },
        { provide: FleetClock, useValue: { now: () => clockNow } },
      ],
    }).compile();
    processor = module.get(DeviceOperationsProcessor);
    save.mockResolvedValue(true);
    currentDevice.mockResolvedValue(true);
    request.mockResolvedValue({ status: 'ACCEPTED', queueIds: ['12'] });
    observations.mockResolvedValue({
      coverageComplete: true,
      readback: { status: 'ABSENT', configurationId: null, parameters: [] },
      observations: [],
    });
  });

  it('persists SUBMITTING before dispatch and retains the captured scope and queue reference', async () => {
    const operation = row();
    await processor.process(operation);
    expect(save).toHaveBeenNthCalledWith(
      1,
      operation,
      { status: 'SUBMITTING', dispatchedAt: now },
      now,
      false,
    );
    expect(request).toHaveBeenCalledWith('41', 'upstream-id');
    expect(save).toHaveBeenLastCalledWith(
      operation,
      {
        status: 'WAITING',
        queueIds: ['12'],
        errorCode: null,
        nextCheckAt: new Date(now.getTime() + 10_000),
      },
      now,
    );
    const savedFirst = save.mock.invocationCallOrder[0] ?? 0;
    const requested = request.mock.invocationCallOrder[0] ?? 0;
    expect(savedFirst).toBeLessThan(requested);
  });

  it('does not send when the database fence rejected the claim', async () => {
    save.mockResolvedValue(false);
    await processor.process(row());
    expect(request).not.toHaveBeenCalled();
  });

  it('recovers interrupted submission as uncertain without resending', async () => {
    const operation = row('SUBMITTING');
    await processor.process(operation);
    expect(request).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      operation,
      { status: 'UNKNOWN', errorCode: 'SUBMISSION_UNCERTAIN', nextCheckAt: now },
      now,
    );
  });

  it('retains an uncertain HTTP send for readback reconciliation rather than automatic retry', async () => {
    request.mockRejectedValue(new Error('Connection closed after upstream accepted'));
    await processor.process(row());
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'UNKNOWN',
        errorCode: 'SUBMISSION_UNCERTAIN',
      }),
      now,
    );
    request.mockClear();
    await processor.process(row('UNKNOWN'));
    expect(request).not.toHaveBeenCalled();
    expect(observations).toHaveBeenCalled();
  });

  it('requires complete coverage and readback rather than merely accepted queue delivery', async () => {
    observations.mockResolvedValue({
      coverageComplete: false,
      readback: { status: 'COMPLETE', configurationId: '01', parameters: [] },
      observations: [],
    });
    await processor.process(row('WAITING'));
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorCode: 'INCOMPLETE_HISTORY',
      }),
      now,
    );
    expect(save.mock.calls[0]?.[1].status).toBeUndefined();
  });

  it('stores complete definitions with zero intact and durable underlying fragments', async () => {
    const rawDefinition = '0296' + '0'.repeat(40);
    observations.mockResolvedValue({
      coverageComplete: true,
      readback: {
        status: 'COMPLETE',
        configurationId: '01',
        parameters: [{ parameterId: 662, reportingIntervalSeconds: 0, rawDefinition }],
      },
      observations: [
        {
          messageId: '1',
          eventTimeUtc: now.toISOString(),
          rawMessage: `19,0,401,0,1,1,01,07${rawDefinition}`,
          configurationId: '01',
          messageNumber: 1,
          lastMessage: true,
          parameters: [{ parameterId: 662, reportingIntervalSeconds: 0, rawDefinition }],
        },
      ],
    });
    await processor.process(row('WAITING'));
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'COMPLETE',
        completedAt: now,
        configurationId: '01',
        configuration: [
          {
            parameterId: 662,
            intervalSeconds: 0,
            definitionHex: '0296' + '0'.repeat(40),
          },
        ],
        observations: {
          coverageComplete: true,
          count: 1,
          items: [expect.objectContaining({ rawMessage: expect.any(String) })],
        },
      }),
      now,
    );
  });

  it('fails a changed local or upstream identity instead of attributing data to another device', async () => {
    currentDevice.mockResolvedValue(false);
    await processor.process(row());
    expect(request).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'LOCAL_DEVICE_CHANGED',
      }),
      now,
    );
    currentDevice.mockResolvedValue(true);
    observations.mockRejectedValue(new KarmaDeviceReadError('TARGET_CHANGED'));
    await processor.process(row('WAITING'));
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'TARGET_CHANGED',
      }),
      now,
    );
  });

  it('times out persisted waiting work without calling the provider', async () => {
    await processor.process({ ...row('UNKNOWN'), deadlineAt: now });
    expect(observations).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith(
      expect.anything(),
      {
        status: 'TIMED_OUT',
        completedAt: now,
        errorCode: 'READ_TIMEOUT',
      },
      now,
    );
  });

  it.each(['provider response', 'local identity recheck'])(
    'times out a complete read when the %s crosses its deadline',
    async (delayedStep) => {
      const operation = { ...row('WAITING'), deadlineAt: new Date(now.getTime() + 1000) };
      const afterDeadline = new Date(now.getTime() + 1001);
      const rawDefinition = '0296' + '0'.repeat(40);
      const completeRead = {
        coverageComplete: true,
        readback: { status: 'COMPLETE', configurationId: '01', parameters: [] },
        observations: [
          {
            messageId: '1',
            eventTimeUtc: now.toISOString(),
            rawMessage: `19,0,401,0,1,1,01,07${rawDefinition}`,
            configurationId: '01',
            messageNumber: 1,
            lastMessage: true,
            parameters: [{ parameterId: 662, reportingIntervalSeconds: 0, rawDefinition }],
          },
        ],
      } satisfies KarmaReadback;
      observations.mockImplementation(() => {
        if (delayedStep === 'provider response') {
          clockNow = afterDeadline;
        }
        return Promise.resolve(completeRead);
      });
      if (delayedStep === 'local identity recheck') {
        currentDevice.mockResolvedValueOnce(true).mockImplementationOnce(() => {
          clockNow = afterDeadline;
          return Promise.resolve(true);
        });
      }
      await processor.process(operation);
      expect(save).toHaveBeenLastCalledWith(
        operation,
        { status: 'TIMED_OUT', completedAt: afterDeadline, errorCode: 'READ_TIMEOUT' },
        afterDeadline,
      );
      expect(save.mock.calls.some(([, update]) => update.status === 'COMPLETE')).toBe(false);
    },
  );
});
