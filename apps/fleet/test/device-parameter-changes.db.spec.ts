import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { encodeRuleData, encodeRuleRecord, parseRuleExpression } from '@holita/edata-rules';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { RequestContext } from '../src/graphql/request-context.js';
import {
  KarmaDeviceReadsClient,
  KarmaDeviceReadError,
  type KarmaReadback,
  type KarmaReadRule,
  type KarmaRulesReadback,
  type KarmaDiagnosticReadback,
} from '../src/integrations/karma/karma-device-reads.client.js';
import { changedDefinition } from '../src/modules/device-operations/device-parameter-change.js';
import { DeviceOperationsProcessor } from '../src/modules/device-operations/device-operations.processor.js';
import { DeviceOperationsRepository } from '../src/modules/device-operations/device-operations.repository.js';
import { DeviceOperationsService } from '../src/modules/device-operations/device-operations.service.js';
import { DeviceRuleOperationsProcessor } from '../src/modules/device-operations/device-rule-operations.processor.js';
import { createTestDatabase } from './test-database.js';

const scope = { tenantId: randomUUID(), branchId: randomUUID() };
const raw = 'FDE8ABCDEF1234561234567890ABCDEF123456780025';
const other = '0296000000000000000000000000000000000000001E';
const otherParameter = { parameterId: 662, intervalSeconds: 30, definitionHex: other };
const baselineConfiguration = [
  { parameterId: 65000, intervalSeconds: 37, definitionHex: raw },
  otherParameter,
];

describe('Durable device operations with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let module: TestingModule | undefined;
  let repository: DeviceOperationsRepository;
  let processor: DeviceOperationsProcessor;
  let service: DeviceOperationsService;
  let now = new Date('2026-10-21T10:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const reads = jest
    .fn<KarmaDeviceReadsClient['request']>()
    .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['21'] });
  const writes = jest
    .fn<KarmaDeviceReadsClient['requestParameter']>()
    .mockResolvedValue({ status: 'UNCERTAIN', queueIds: [] });
  const observations = jest.fn<KarmaDeviceReadsClient['observations']>();
  const ruleReads = jest
    .fn<KarmaDeviceReadsClient['requestRules']>()
    .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['22'] });
  const ruleWrites = jest
    .fn<KarmaDeviceReadsClient['requestRule']>()
    .mockResolvedValue({ status: 'UNCERTAIN', queueIds: [] });
  const rulesObservations = jest.fn<KarmaDeviceReadsClient['rulesObservations']>();
  const diagnosticReads = jest
    .fn<KarmaDeviceReadsClient['requestDiagnostic']>()
    .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['23'] });
  const diagnosticObservations = jest.fn<KarmaDeviceReadsClient['diagnosticObservations']>();
  const diagnosticWatermark = jest
    .fn<KarmaDeviceReadsClient['diagnosticWatermark']>()
    .mockResolvedValue('7179000000');
  const target = jest
    .fn<KarmaDeviceReadsClient['target']>()
    .mockImplementation((carId) => Promise.resolve({ carId, deviceId: `opaque-${carId}` }));
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const originalReadFlag = process.env.FLEET_DEVICE_OPERATIONS_ENABLED;
  const originalWriteFlag = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED;

  async function start() {
    module = await Test.createTestingModule({
      providers: [
        DeviceOperationsRepository,
        DeviceOperationsProcessor,
        DeviceRuleOperationsProcessor,
        DeviceOperationsService,
        { provide: PrismaService, useValue: { client: database.client } },
        { provide: FleetClock, useValue: clock },
        { provide: CoreClient, useValue: { requireBranch } },
        {
          provide: KarmaDeviceReadsClient,
          useValue: {
            request: reads,
            requestParameter: writes,
            observations,
            target,
            requestRules: ruleReads,
            requestRule: ruleWrites,
            rulesObservations,
            requestDiagnostic: diagnosticReads,
            diagnosticObservations,
            diagnosticWatermark,
          },
        },
      ],
    }).compile();
    repository = module.get(DeviceOperationsRepository);
    processor = module.get(DeviceOperationsProcessor);
    service = module.get(DeviceOperationsService);
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
  async function baseline(carId: string, selectedScope = scope) {
    return database.client.fleetDeviceOperation.create({
      data: {
        ...selectedScope,
        karmaCarId: carId,
        karmaDeviceId: `opaque-${carId}`,
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
  function context(selectedScope = scope): RequestContext {
    return {
      ...selectedScope,
      requestId: 'rule-contract',
      authorization: undefined,
      branchChecks: new Map(),
    };
  }
  function rulesReply(
    rules: KarmaReadRule[],
    messageId: string,
    number = 1,
    last = true,
  ): KarmaRulesReadback {
    return {
      coverageComplete: true,
      readback: { status: last ? 'COMPLETE' : 'INCOMPLETE', configurationId: '9', rules: [] },
      observations: [
        {
          messageId,
          eventTimeUtc: now.toISOString(),
          rawMessage: `19,0,402,0,${last ? '1' : '0'},${String(number)},9,08${rules.map((rule) => rule.rawDefinition).join('')}`,
          configurationId: '9',
          messageNumber: number,
          lastMessage: last,
          rules,
        },
      ],
    };
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

  it('preserves scoped writes and diagnostic reads across restart without replaying ambiguous submissions', async () => {
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
      'opaque-9101',
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

    // An expired lease after the durable write marker recovers without replaying the command.
    const leased = await baseline('9102');
    const recovering = await repository.createWrite(
      scope,
      leased,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: leased.id,
        parameterId: 65000,
        intervalSeconds: 0,
        catalogId: null,
      },
      now,
    );
    await database.client.fleetDeviceOperation.update({
      where: { id: recovering.id },
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
    expect(writes).toHaveBeenCalledTimes(1);
    await database.client.fleetDeviceOperation.update({
      where: { id: recovering.id },
      data: { status: 'FAILED', completedAt: now, errorCode: 'TEST_RECOVERY_COMPLETE' },
    });

    const parameterBaseline = await baseline('9103');
    const ruleTarget = {
      karmaCarId: '9103',
      expectedKarmaDeviceId: 'opaque-9103',
    };
    const originalRule = {
      ruleId: 1,
      rawDefinition: encodeRuleRecord({
        ruleId: 1,
        trueEventId: 0,
        falseEventId: 0,
        debounceMilliseconds: 1,
        activateDashboard: true,
        ruleDataHex: encodeRuleData(parseRuleExpression('[65000] > 1')),
      }),
    };
    const opaqueRule = { ruleId: 2, rawDefinition: '000200000000800101FF' };
    const originalRules = [originalRule, opaqueRule];
    const requestedRules = await service.requestRules(context(), ruleTarget);
    await advance();
    rulesObservations.mockResolvedValueOnce(rulesReply(originalRules, '201'));
    const ruleBaseline = await advance();
    expect(ruleBaseline).toMatchObject({
      id: requestedRules.id,
      kind: 'READ_RULES',
      status: 'COMPLETE',
      rules: originalRules,
    });
    expect(
      await service.snapshot(context(), ruleTarget.karmaCarId, ruleTarget.expectedKarmaDeviceId),
    ).toMatchObject({
      id: parameterBaseline.id,
    });
    expect(
      await service.rulesSnapshot(
        context(),
        ruleTarget.karmaCarId,
        ruleTarget.expectedKarmaDeviceId,
      ),
    ).toMatchObject({
      id: requestedRules.id,
      rulesConfiguration: {
        rules: [
          { ruleId: 1, activateDashboard: true, expression: '([65000] > 1)' },
          {
            ruleId: 2,
            activateDashboard: true,
            definitionHex: opaqueRule.rawDefinition,
            expression: null,
          },
        ],
      },
    });
    const ruleInput = {
      ...ruleTarget,
      baselineOperationId: requestedRules.id,
      parameterBaselineOperationId: parameterBaseline.id,
      ruleId: 1,
      expression: '[65000] > 10',
      trueEventId: 0,
      falseEventId: 0,
      debounceMilliseconds: 1,
    };
    for (const foreignScope of [
      { ...scope, tenantId: randomUUID() },
      { ...scope, branchId: randomUUID() },
    ]) {
      expect(await repository.find(foreignScope, requestedRules.id)).toBeNull();
      await expect(service.requestRuleChange(context(foreignScope), ruleInput)).rejects.toThrow(
        'Read complete rules and parameters',
      );
      expect(
        await service.rulesSnapshot(
          context(foreignScope),
          ruleTarget.karmaCarId,
          ruleTarget.expectedKarmaDeviceId,
        ),
      ).toBeNull();
      expect(await service.history(context(foreignScope), '9103', 'opaque-9103')).toEqual([]);
    }
    await expect(
      service.requestRuleChange(context(), { ...ruleInput, expression: '[999] > 1' }),
    ).rejects.toThrow('Every referenced parameter');
    await expect(service.requestRuleChange(context(), { ...ruleInput, ruleId: 2 })).rejects.toThrow(
      'must remain unchanged',
    );
    await expect(
      service.requestRuleChange(context(), {
        ...ruleInput,
        parameterBaselineOperationId: leased.id,
      }),
    ).rejects.toThrow('Read complete rules and parameters');
    const requestedChange = await service.requestRuleChange(context(), ruleInput);
    expect(requestedChange).toMatchObject({
      kind: 'UPSERT_RULE',
      ruleId: 1,
      phase: 'READ_PARAMETERS',
    });
    const foreignBaseline = await baseline('9199', { ...scope, branchId: randomUUID() });
    await expect(
      database.client.fleetDeviceOperation.update({
        where: { id: requestedChange.id },
        data: { parameterBaselineOperationId: foreignBaseline.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });

    await advance(); // Parameter and rule preflight reads must both confirm the captured baselines.
    observations.mockResolvedValueOnce(reply(baselineConfiguration, '202'));
    expect(await advance()).toMatchObject({ phase: 'READ_RULES', status: 'QUEUED' });
    await advance();
    rulesObservations.mockResolvedValueOnce(rulesReply(originalRules, '203'));
    expect(await advance()).toMatchObject({ phase: 'WRITE_RULE', status: 'QUEUED' });
    const changedRule = {
      ruleId: 1,
      rawDefinition: encodeRuleRecord({
        ruleId: 1,
        trueEventId: 0,
        falseEventId: 0,
        debounceMilliseconds: 1,
        activateDashboard: true,
        ruleDataHex: encodeRuleData(parseRuleExpression('[65000] > 10')),
      }),
    };
    expect(await advance()).toMatchObject({
      phase: 'VERIFY_RULES',
      status: 'QUEUED',
      writeUncertain: true,
    });
    expect(ruleWrites).toHaveBeenCalledTimes(1);

    expect(ruleWrites).toHaveBeenLastCalledWith(
      '9103',
      'opaque-9103',
      1,
      changedRule.rawDefinition,
    );
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'false';
    await module?.close();
    await start();
    await advance();
    rulesObservations.mockResolvedValueOnce(rulesReply(originalRules, '204'));
    expect(await advance()).toMatchObject({
      status: 'QUEUED',
      errorCode: 'WRITE_NOT_OBSERVED',
      rulesAfterMessageId: '204',
    });
    await advance();
    rulesObservations.mockResolvedValueOnce(rulesReply([opaqueRule], '205', 1, false));
    expect(await advance()).toMatchObject({ status: 'WAITING', rulesObservations: { count: 1 } });
    await module?.close();
    await start();
    rulesObservations.mockResolvedValueOnce(rulesReply([changedRule], '206', 2, true));
    expect(await advance()).toMatchObject({
      status: 'COMPLETE',
      phase: 'VERIFY_RULES',
      rules: [changedRule, opaqueRule],
      rulesObservations: { count: 2 },
      baselineRules: originalRules,
    });
    expect(ruleWrites).toHaveBeenCalledTimes(1);
    expect(writes).toHaveBeenCalledTimes(1);
    process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED = 'true';
    const ruleRecovery = await service.requestRuleChange(context(), {
      ...ruleInput,
      expression: '[65000] > 11',
    });
    await database.client.fleetDeviceOperation.update({
      where: { id: ruleRecovery.id },
      data: {
        phase: 'WRITE_RULE',
        status: 'SUBMITTING',
        dispatchedAt: now,
        baselineReadAt: now,
        rulesReadAt: now,
        writeDispatchedAt: now,
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() + 30_000),
      },
    });
    await module?.close();
    await start();
    now = new Date(now.getTime() + 31_000);
    expect(await advance()).toMatchObject({
      phase: 'VERIFY_RULES',
      status: 'QUEUED',
      writeUncertain: true,
    });
    expect(ruleWrites).toHaveBeenCalledTimes(1);
    await database.client.fleetDeviceOperation.update({
      where: { id: ruleRecovery.id },
      data: { status: 'FAILED', completedAt: now },
    });
    const intervalInput = {
      ...ruleTarget,
      baselineOperationId: parameterBaseline.id,
      parameterId: 65000,
      intervalSeconds: 12,
    };
    const staleTarget = { ...ruleTarget, expectedKarmaDeviceId: 'stale-target' };
    const staleRequests = [
      () => service.request(context(), staleTarget),
      () => service.requestRules(context(), staleTarget),
      () =>
        service.requestAddition(context(), {
          ...intervalInput,
          ...staleTarget,
          catalogId: randomUUID(),
        }),
      () => service.requestIntervalUpdate(context(), { ...intervalInput, ...staleTarget }),
      () => service.requestRuleChange(context(), { ...ruleInput, ...staleTarget }),
    ];
    for (const request of staleRequests) {
      await expect(request()).rejects.toThrow('The Karma device target has changed.');
    }
    // The operation history belongs to the verified scope and captured upstream pair.
    expect(await service.snapshot(context(), '9103', 'replacement')).toBeNull();
    expect(await service.rulesSnapshot(context(), '9103', 'replacement')).toBeNull();
    expect(await service.find(context(), requestedRules.id)).toMatchObject({
      id: requestedRules.id,
      branchId: scope.branchId,
      karmaCarId: '9103',
      karmaDeviceId: 'opaque-9103',
      status: 'COMPLETE',
    });
    const requestContext = context();
    requireBranch.mockRejectedValueOnce(new NotFoundException('Branch not found'));
    await expect(service.request(requestContext, ruleTarget)).rejects.toThrow('Branch not found');
    expect(requireBranch).toHaveBeenLastCalledWith(scope.branchId, requestContext);
    const directRead = await service.request(context(), ruleTarget);
    expect(await repository.find(scope, directRead.id)).toMatchObject({
      deviceId: null,
      deviceImei: null,
      karmaCarId: '9103',
      karmaDeviceId: 'opaque-9103',
    });
    expect(await database.client.device.count({ where: scope })).toBe(0);
    // The transport rejects a replaced upstream device before accepting the queued request.
    reads.mockRejectedValueOnce(new KarmaDeviceReadError('TARGET_CHANGED'));
    expect(await advance()).toMatchObject({ status: 'FAILED', errorCode: 'TARGET_CHANGED' });
    expect(reads).toHaveBeenLastCalledWith('9103', 'opaque-9103');
    target.mockResolvedValueOnce({ carId: '9103', deviceId: 'replacement' });
    await expect(service.requestRules(context(), ruleTarget)).rejects.toThrow(
      'The Karma device target has changed.',
    );
    target.mockResolvedValueOnce({ carId: '9103', deviceId: 'replacement' });
    const replacementRead = await service.request(context(), {
      ...ruleTarget,
      expectedKarmaDeviceId: 'replacement',
    });
    await advance();
    // Polling observations also respects a target replacement and cannot publish old evidence.
    observations.mockRejectedValueOnce(new KarmaDeviceReadError('TARGET_CHANGED'));
    expect(await advance()).toMatchObject({
      id: replacementRead.id,
      status: 'FAILED',
      errorCode: 'TARGET_CHANGED',
    });

    // The device's terminal response is evidence of an unanswered read, never an empty baseline.
    const terminalResponse = {
      messageId: '301',
      eventTimeUtc: now.toISOString(),
      rawMessage: '19,0,154,0',
    } satisfies NonNullable<KarmaReadback['terminalResponse']>;
    const noConfiguration = {
      coverageComplete: true,
      readback: {
        status: 'ABSENT',
        configurationId: null,
        parameters: [],
        rules: [],
      },
      observations: [],
      terminalResponse,
    } satisfies KarmaReadback & KarmaRulesReadback;
    for (const kind of ['READ_CONFIGURATION', 'READ_RULES'] as const) {
      const selected = {
        karmaCarId: kind === 'READ_CONFIGURATION' ? '9104' : '9105',
        expectedKarmaDeviceId: kind === 'READ_CONFIGURATION' ? 'opaque-9104' : 'opaque-9105',
      };
      const request =
        kind === 'READ_CONFIGURATION'
          ? await service.request(context(), selected)
          : await service.requestRules(context(), selected);
      await advance();
      if (kind === 'READ_CONFIGURATION') {
        observations.mockResolvedValueOnce(noConfiguration);
      } else {
        rulesObservations.mockResolvedValueOnce(noConfiguration);
      }
      expect(await advance()).toMatchObject({
        id: request.id,
        status: 'FAILED',
        errorCode: 'READ_NO_CONFIGURATION',
        configurationId: null,
        configuration: null,
        rulesConfigurationId: null,
        rules: null,
        [kind === 'READ_CONFIGURATION' ? 'observations' : 'rulesObservations']: {
          count: 0,
          terminalResponse,
        },
      });
      expect(
        await service.snapshot(context(), selected.karmaCarId, selected.expectedKarmaDeviceId),
      ).toBeNull();
      expect(
        await service.rulesSnapshot(context(), selected.karmaCarId, selected.expectedKarmaDeviceId),
      ).toBeNull();
    }
    const completeWithTerminal = await service.requestRules(context(), ruleTarget);
    await advance();
    rulesObservations.mockResolvedValueOnce({
      ...rulesReply(originalRules, '302'),
      terminalResponse,
    });
    expect(await advance()).toMatchObject({
      id: completeWithTerminal.id,
      status: 'COMPLETE',
      rules: originalRules,
      rulesObservations: { terminalResponse },
    });
    const unansweredPreflight = await repository.createWrite(
      scope,
      parameterBaseline,
      {
        kind: 'UPDATE_INTERVAL',
        baselineOperationId: parameterBaseline.id,
        parameterId: 65000,
        intervalSeconds: 12,
        catalogId: null,
      },
      now,
    );
    await advance();
    observations.mockResolvedValueOnce(noConfiguration);
    expect(await advance()).toMatchObject({
      id: unansweredPreflight.id,
      status: 'FAILED',
      errorCode: 'READ_NO_CONFIGURATION',
      writeDispatchedAt: null,
      observations: { terminalResponse },
    });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(ruleWrites).toHaveBeenCalledTimes(1);
    const diagnosticTarget = {
      karmaCarId: '9106',
      expectedKarmaDeviceId: 'opaque-9106',
      kind: 'READ_FAULT_LOGGER',
    } as const;
    const diagnosticRead = await service.requestDiagnostic(context(), diagnosticTarget);
    for (const foreignScope of [
      { ...scope, tenantId: randomUUID() },
      { ...scope, branchId: randomUUID() },
    ]) {
      expect(await service.find(context(foreignScope), diagnosticRead.id)).toBeNull();
      expect(await service.diagnosticHistory(context(foreignScope), '9106', 'opaque-9106')).toEqual(
        [],
      );
    }
    await expect(service.requestDiagnostic(context(), diagnosticTarget)).rejects.toThrow(
      'already active',
    );
    await advance();
    expect(diagnosticReads).toHaveBeenLastCalledWith(
      '9106',
      'opaque-9106',
      'READ_FAULT_LOGGER',
      [],
    );
    expect(await repository.find(scope, diagnosticRead.id)).toMatchObject({
      readAfterMessageId: '7179000000',
    });
    const positiveAck = {
      messageId: '7179129747',
      eventTimeUtc: now.toISOString(),
      rawMessage: '19,0,154,1',
      family: 'SPECIAL_ACK',
      acknowledgement: 'POSITIVE_ACK',
    } satisfies KarmaDiagnosticReadback['observations'][number];
    diagnosticObservations.mockResolvedValueOnce({
      coverageComplete: true,
      queue: [{ id: '23', state: 1 }],
      observations: [positiveAck],
    });
    expect(await advance()).toMatchObject({
      status: 'WAITING',
      errorCode: 'NO_OBSERVED_REPORT',
      observations: { queue: [{ id: '23', state: 1 }], observations: [positiveAck] },
    });
    expect(diagnosticObservations).toHaveBeenLastCalledWith(
      '9106',
      'opaque-9106',
      expect.any(Date),
      expect.any(Date),
      ['23'],
      '7179000000',
    );
    await module?.close();
    await start();
    const negativeAck = {
      ...positiveAck,
      messageId: '7180175996',
      eventTimeUtc: now.toISOString(),
      rawMessage: '19,0,154,0',
      acknowledgement: 'NACK',
    } satisfies KarmaDiagnosticReadback['observations'][number];
    diagnosticObservations.mockResolvedValueOnce({
      coverageComplete: true,
      queue: [{ id: '23', state: 1 }],
      observations: [negativeAck],
    });
    expect(await advance()).toMatchObject({
      status: 'FAILED',
      errorCode: 'DEVICE_NACK',
      configuration: null,
      observations: { count: 2 },
    });
    expect(diagnosticReads).toHaveBeenCalledTimes(1);
    expect(await service.find(context(), diagnosticRead.id)).toMatchObject({
      diagnosticQueue: [{ id: '23', state: 1 }],
      diagnosticObservations: [
        { messageId: negativeAck.messageId, acknowledgement: 'NACK' },
        { messageId: positiveAck.messageId, acknowledgement: 'POSITIVE_ACK' },
      ],
    });
    // A retained provider queue is reconciled before another command; a pending queue is not replayed.
    diagnosticReads.mockResolvedValueOnce({ status: 'PENDING', queueIds: ['23'] });
    const blockedRead = await service.requestDiagnostic(context(), diagnosticTarget);
    expect(await advance()).toMatchObject({
      id: blockedRead.id,
      status: 'FAILED',
      errorCode: 'EXISTING_REQUEST_PENDING',
      queueIds: [],
      observations: { queue: [] },
    });
    expect(diagnosticReads).toHaveBeenLastCalledWith('9106', 'opaque-9106', 'READ_FAULT_LOGGER', [
      '23',
    ]);

    now = new Date('2026-10-29T12:53:50.000Z');
    const actualFaultTarget = {
      karmaCarId: '16595',
      expectedKarmaDeviceId: '862129080367299',
      kind: 'READ_FAULT_LOGGER',
    } as const;
    target.mockResolvedValueOnce({ carId: '16595', deviceId: '862129080367299' });
    const actualFaultRead = await service.requestDiagnostic(context(), actualFaultTarget);
    await advance();
    const actualFault = {
      messageId: '7179721665',
      eventTimeUtc: '2026-10-29T12:54:06.000Z',
      rawMessage: '19,0,419,0,1,1,1001,2100005CFE0F01',
      family: 'FAULT_REPORT',
      acknowledgement: null,
    } satisfies KarmaDiagnosticReadback['observations'][number];
    diagnosticObservations.mockResolvedValueOnce({
      coverageComplete: false,
      queue: [{ id: '23', state: 1 }],
      observations: [actualFault],
    });
    expect(await advance()).toMatchObject({
      id: actualFaultRead.id,
      status: 'COMPLETE',
      configuration: null,
      observations: { coverageComplete: false, observations: [actualFault] },
    });
    expect(
      await service.snapshot(
        context(),
        actualFaultTarget.karmaCarId,
        actualFaultTarget.expectedKarmaDeviceId,
      ),
    ).toBeNull();
    expect(
      await service.diagnosticHistory(
        context(),
        actualFaultTarget.karmaCarId,
        actualFaultTarget.expectedKarmaDeviceId,
      ),
    ).toMatchObject([{ id: actualFaultRead.id, coverageComplete: false }]);

    now = new Date('2026-10-29T15:03:50.000Z');
    target.mockResolvedValueOnce({ carId: '16586', deviceId: '862129080320033' });
    const communicationsRead = await service.requestDiagnostic(context(), {
      karmaCarId: '16586',
      expectedKarmaDeviceId: '862129080320033',
      kind: 'READ_COMMUNICATION_DIAGNOSTICS',
    });
    await advance();
    const communications = {
      messageId: '7180194143',
      eventTimeUtc: '2026-10-29T15:04:01.000Z',
      rawMessage: '19,0,411,0,1,1,1001,00000001010C87',
      family: 'COMMUNICATION_DIAGNOSTICS',
      acknowledgement: null,
    } satisfies KarmaDiagnosticReadback['observations'][number];
    diagnosticObservations.mockResolvedValueOnce({
      coverageComplete: true,
      queue: [{ id: '23', state: 1 }],
      observations: [communications],
    });
    expect(await advance()).toMatchObject({
      id: communicationsRead.id,
      status: 'COMPLETE',
      observations: { observations: [communications] },
    });
    diagnosticReads.mockResolvedValueOnce({ status: 'UNCERTAIN', queueIds: [] });
    const uncertainRead = await service.requestDiagnostic(context(), {
      karmaCarId: '9108',
      expectedKarmaDeviceId: 'opaque-9108',
      kind: 'READ_FAULT_LOGGER',
    });
    expect(await advance()).toMatchObject({ status: 'UNKNOWN', errorCode: 'SUBMISSION_UNCERTAIN' });
    const submissions = diagnosticReads.mock.calls.length;
    await module?.close();
    await start();
    const unresolvedFault = {
      ...actualFault,
      messageId: '7179721666',
      eventTimeUtc: now.toISOString(),
      rawMessage: '19,0,419,0,1,1,1001,21',
      family: 'UNRESOLVED_FAULT_REPORT',
    } satisfies KarmaDiagnosticReadback['observations'][number];
    diagnosticObservations.mockResolvedValueOnce({
      coverageComplete: false,
      queue: [],
      observations: [unresolvedFault],
    });
    expect(await advance()).toMatchObject({
      status: 'UNKNOWN',
      errorCode: 'INCOMPLETE_HISTORY',
      observations: { observations: [unresolvedFault] },
    });
    expect(diagnosticReads).toHaveBeenCalledTimes(submissions);
    now = new Date(now.getTime() + 600_000);
    expect(await advance()).toMatchObject({
      id: uncertainRead.id,
      status: 'TIMED_OUT',
      errorCode: 'READ_TIMEOUT',
    });
    expect(diagnosticReads).toHaveBeenCalledTimes(submissions);

    const retainedTarget = {
      karmaCarId: '9110',
      expectedKarmaDeviceId: 'opaque-9110',
      kind: 'READ_FAULT_LOGGER',
    } as const;
    diagnosticReads.mockResolvedValueOnce({ status: 'ACCEPTED', queueIds: ['24'] });
    const timedOutRead = await service.requestDiagnostic(context(), retainedTarget);
    expect(await advance()).toMatchObject({ id: timedOutRead.id, status: 'WAITING' });
    now = new Date(now.getTime() + 600_000);
    expect(await advance()).toMatchObject({ id: timedOutRead.id, status: 'TIMED_OUT' });
    for (const foreignScope of [
      { ...scope, tenantId: randomUUID() },
      { ...scope, branchId: randomUUID() },
    ]) {
      expect(
        await service.diagnosticHistory(context(foreignScope), '9110', 'opaque-9110'),
      ).toEqual([]);
      // The shared provider queue remains pending even after this workspace's local deadline.
      diagnosticReads.mockResolvedValueOnce({ status: 'PENDING', queueIds: ['24'] });
      const blocked = await service.requestDiagnostic(context(foreignScope), retainedTarget);
      await advance();
      expect(await repository.find(foreignScope, blocked.id)).toMatchObject({
        id: blocked.id,
        status: 'FAILED',
        errorCode: 'EXISTING_REQUEST_PENDING',
        queueIds: [],
        observations: { queue: [] },
      });
      expect(diagnosticReads).toHaveBeenLastCalledWith(
        '9110',
        'opaque-9110',
        'READ_FAULT_LOGGER',
        ['24'],
      );
      expect(
        (await service.diagnosticHistory(context(foreignScope), '9110', 'opaque-9110')).map(
          (operation) => operation.id,
        ),
      ).toEqual([blocked.id]);
    }
    expect(
      (await service.diagnosticHistory(context(), '9110', 'opaque-9110')).map(
        (operation) => operation.id,
      ),
    ).toEqual([timedOutRead.id]);
  });
});
