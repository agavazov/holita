import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  decodeRuleRecord,
  encodeRuleData,
  encodeRuleRecord,
  parseRuleExpression,
  referencedParameterIds,
  renderRuleExpression,
} from '@holita/edata-rules';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetDeviceConfiguration,
  FleetDeviceOperation,
  RequestFleetDeviceConfigurationReadInput,
  RequestFleetDeviceParameterAdditionInput,
  RequestFleetDeviceParameterIntervalUpdateInput,
  RequestFleetDeviceRulesReadInput,
  RequestFleetDeviceRuleChangeInput,
  RequestFleetDeviceDiagnosticReadInput,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { KarmaDeviceReadsClient } from '../../integrations/karma/karma-device-reads.client.js';
import { integer, invalid, requireScope, text, uuid, type FleetScope } from '../../validation.js';
import { configurationParameters } from './device-parameter-change.js';
import { configurationRules, deviceRuleResult } from './device-rule-change.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
  type DeviceReadKind,
} from './device-operations.repository.js';
import { diagnosticEvidence } from './device-diagnostic-evidence.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configuration(row: DeviceOperationRow): FleetDeviceConfiguration | null {
  if (row.status !== 'COMPLETE' || !row.configurationId || !Array.isArray(row.configuration)) {
    return null;
  }
  const parameters = configurationParameters(row.configuration);
  return { configurationId: row.configurationId, parameters };
}

export function deviceOperationResult(row: DeviceOperationRow): FleetDeviceOperation {
  const diagnostics =
    row.kind === 'READ_FAULT_LOGGER' || row.kind === 'READ_COMMUNICATION_DIAGNOSTICS'
      ? diagnosticEvidence(row.observations)
      : null;
  const observed =
    row.kind === 'READ_RULES' || row.kind === 'UPSERT_RULE'
      ? row.rulesObservations
      : row.observations;
  const evidence = record(observed) ? observed : {};
  return {
    id: row.id,
    branchId: row.branchId,
    karmaCarId: row.karmaCarId,
    karmaDeviceId: row.karmaDeviceId,
    status: row.status,
    kind: row.kind,
    phase: row.phase,
    baselineOperationId: row.baselineOperationId,
    parameterBaselineOperationId: row.parameterBaselineOperationId,
    ruleId: row.ruleId,
    ruleExpression: row.ruleExpression,
    ruleTrueEventId: row.ruleTrueEventId,
    ruleFalseEventId: row.ruleFalseEventId,
    ruleDebounceMilliseconds: row.ruleDebounceMilliseconds,
    parameterId: row.parameterId,
    intervalSeconds: row.intervalSeconds,
    previousIntervalSeconds: row.previousIntervalSeconds,
    catalogId: row.catalogId,
    profileId: row.profileId,
    writeDispatchedAt: row.writeDispatchedAt,
    writeUncertain: row.writeUncertain,
    requestedAt: row.requestedAt,
    dispatchedAt: row.dispatchedAt,
    completedAt: row.completedAt,
    nextCheckAt: row.nextCheckAt,
    deadlineAt: row.deadlineAt,
    queueIds: row.queueIds,
    observationCount:
      typeof evidence.count === 'number' && Number.isSafeInteger(evidence.count)
        ? evidence.count
        : 0,
    coverageComplete: evidence.coverageComplete === true,
    diagnosticQueue: diagnostics?.queue ?? [],
    diagnosticObservations:
      diagnostics?.observations.map((observation) => ({
        ...observation,
        eventTimeUtc: new Date(observation.eventTimeUtc),
      })) ?? [],
    configuration: configuration(row),
    rulesConfiguration:
      row.status === 'COMPLETE' && row.rulesConfigurationId && Array.isArray(row.rules)
        ? {
            configurationId: row.rulesConfigurationId,
            rules: configurationRules(row.rules).map(deviceRuleResult),
          }
        : null,
    errorCode: row.errorCode,
  };
}

@Injectable()
export class DeviceOperationsService {
  constructor(
    private readonly operations: DeviceOperationsRepository,
    private readonly karma: KarmaDeviceReadsClient,
    private readonly clock: FleetClock,
    private readonly core: CoreClient,
  ) {}

  /** Trusted monitoring jobs use persisted, Core-verified Branch settings. Only the fixed read is available. */
  async requestMonitoringFaultRead(scope: FleetScope, carId: string, deviceId: string) {
    if (!deviceOperationsEnabled()) {
      return null;
    }
    const target = karmaTarget(carId, deviceId);
    await this.verifyTarget(target);
    try {
      return deviceOperationResult(
        await this.operations.create(scope, target, this.clock.now(), 'READ_FAULT_LOGGER', true),
      );
    } catch (error) {
      // The existing account-wide unique active-car index also excludes user reads in flight.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async monitoringOperation(scope: FleetScope, id: string) {
    const row = await this.operations.find(scope, id);
    return row?.monitoringOrigin ? deviceOperationResult(row) : null;
  }

  pruneMonitoring(scope: FleetScope, cutoff: Date) {
    return this.operations.pruneMonitoring(scope, cutoff);
  }

  enabled(context: RequestContext): boolean {
    requireScope(context);
    return deviceOperationsEnabled();
  }

  writesEnabled(context: RequestContext): boolean {
    requireScope(context);
    return deviceConfigurationWritesEnabled();
  }

  presets(context: RequestContext) {
    requireScope(context);
    return this.operations.presets();
  }

  async requestAddition(
    context: RequestContext,
    input: RequestFleetDeviceParameterAdditionInput,
  ): Promise<FleetDeviceOperation> {
    return this.requestWrite(context, input, 'ADD_PARAMETER');
  }

  async requestIntervalUpdate(
    context: RequestContext,
    input: RequestFleetDeviceParameterIntervalUpdateInput,
  ): Promise<FleetDeviceOperation> {
    return this.requestWrite(context, input, 'UPDATE_INTERVAL');
  }

  requestRules(
    context: RequestContext,
    input: RequestFleetDeviceRulesReadInput,
  ): Promise<FleetDeviceOperation> {
    return this.request(context, input, 'READ_RULES');
  }

  requestDiagnostic(
    context: RequestContext,
    input: RequestFleetDeviceDiagnosticReadInput,
  ): Promise<FleetDeviceOperation> {
    return this.request(context, input, input.kind);
  }

  async diagnosticHistory(
    context: RequestContext,
    karmaCarId: string,
    expectedKarmaDeviceId: string,
  ): Promise<FleetDeviceOperation[]> {
    const scope = requireScope(context);
    const target = karmaTarget(karmaCarId, expectedKarmaDeviceId);
    return (await this.operations.diagnosticHistory(scope, target)).map(deviceOperationResult);
  }

  async requestRuleChange(
    context: RequestContext,
    input: RequestFleetDeviceRuleChangeInput,
  ): Promise<FleetDeviceOperation> {
    const scope = requireScope(context);
    if (!deviceConfigurationWritesEnabled()) {
      throw new ServiceUnavailableException('Device configuration writing is disabled');
    }
    const baselineId = uuid(input.baselineOperationId, 'baselineOperationId');
    const parameterBaselineId = uuid(
      input.parameterBaselineOperationId,
      'parameterBaselineOperationId',
    );
    const ruleId = integer(input.ruleId, 'ruleId', 0, 65535);
    const ruleTrueEventId = integer(input.trueEventId, 'trueEventId', 0, 65535);
    const ruleFalseEventId = integer(input.falseEventId, 'falseEventId', 0, 65535);
    const ruleDebounceMilliseconds = integer(
      input.debounceMilliseconds,
      'debounceMilliseconds',
      1,
      32767,
    );
    const source = text(input.expression, 'expression', 4096);
    const expression = (() => {
      try {
        return parseRuleExpression(source);
      } catch {
        invalid('expression', 'Use a supported rule expression.', 'INVALID_FORMAT');
      }
    })();
    const target = karmaTarget(input.karmaCarId, input.expectedKarmaDeviceId);
    await this.core.requireBranch(scope.branchId, context);
    await this.verifyTarget(target);
    const baseline = await this.operations.find(scope, baselineId);
    const parameterBaseline = await this.operations.find(scope, parameterBaselineId);
    for (const row of [baseline, parameterBaseline]) {
      if (
        !row ||
        row.status !== 'COMPLETE' ||
        row.karmaCarId !== target.karmaCarId ||
        row.karmaDeviceId !== target.karmaDeviceId
      ) {
        throw new ConflictException(
          'Read complete rules and parameters for the selected device and Karma target.',
        );
      }
    }
    if (
      !baseline?.rulesConfigurationId ||
      !Array.isArray(baseline.rules) ||
      !parameterBaseline?.configurationId ||
      !Array.isArray(parameterBaseline.configuration)
    ) {
      throw new ConflictException(
        'Read complete rules and parameters for the selected device and Karma target.',
      );
    }
    const rules = configurationRules(baseline.rules);
    const previous = rules.find((rule) => rule.ruleId === ruleId);
    if (previous && deviceRuleResult(previous).expression === null) {
      invalid(
        'ruleId',
        'This rule uses an unsupported expression and must remain unchanged.',
        'UNSUPPORTED_VALUE',
      );
    }
    if (!previous && rules.length >= 1000) {
      invalid(
        'ruleId',
        'The rules exceed the supported readback capacity.',
        'CONFIGURATION_CAPACITY',
      );
    }
    const parameters = new Set(
      configurationParameters(parameterBaseline.configuration).map(
        (parameter) => parameter.parameterId,
      ),
    );
    if (referencedParameterIds(expression).some((id) => !parameters.has(id))) {
      invalid(
        'expression',
        'Every referenced parameter must exist in the confirmed device configuration.',
        'UNSUPPORTED_VALUE',
      );
    }
    const ruleDefinitionHex = (() => {
      try {
        return encodeRuleRecord({
          ruleId,
          trueEventId: ruleTrueEventId,
          falseEventId: ruleFalseEventId,
          debounceMilliseconds: ruleDebounceMilliseconds,
          activateDashboard: previous
            ? decodeRuleRecord(previous.rawDefinition).activateDashboard
            : false,
          ruleDataHex: encodeRuleData(expression),
        });
      } catch {
        invalid(
          'expression',
          'Use a supported expression of at most 128 encoded bytes.',
          'INVALID_FORMAT',
        );
      }
    })();
    if (previous?.rawDefinition === ruleDefinitionHex) {
      invalid('expression', 'Change the rule before submitting.', 'VALUE_UNCHANGED');
    }
    try {
      return deviceOperationResult(
        await this.operations.createRuleWrite(
          scope,
          baseline,
          parameterBaseline,
          {
            ruleId,
            ruleExpression: renderRuleExpression(expression),
            ruleTrueEventId,
            ruleFalseEventId,
            ruleDebounceMilliseconds,
            ruleDefinitionHex,
          },
          this.clock.now(),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A configuration operation for this Karma target is already active.',
        );
      }
      throw error;
    }
  }

  private async requestWrite(
    context: RequestContext,
    input:
      RequestFleetDeviceParameterAdditionInput | RequestFleetDeviceParameterIntervalUpdateInput,
    kind: 'ADD_PARAMETER' | 'UPDATE_INTERVAL',
  ): Promise<FleetDeviceOperation> {
    const scope = requireScope(context);
    if (!deviceConfigurationWritesEnabled()) {
      throw new ServiceUnavailableException('Device configuration writing is disabled');
    }
    const baselineOperationId = uuid(input.baselineOperationId, 'baselineOperationId');
    const parameterId = integer(input.parameterId, 'parameterId', 0, 65535);
    const intervalSeconds = integer(input.intervalSeconds, 'intervalSeconds', 0, 65000);
    const target = karmaTarget(input.karmaCarId, input.expectedKarmaDeviceId);
    await this.core.requireBranch(scope.branchId, context);
    await this.verifyTarget(target);
    const baseline = await this.operations.find(scope, baselineOperationId);
    if (
      !baseline ||
      baseline.status !== 'COMPLETE' ||
      baseline.karmaCarId !== target.karmaCarId ||
      baseline.karmaDeviceId !== target.karmaDeviceId ||
      !baseline.configurationId
    ) {
      throw new ConflictException(
        'Read and confirm a complete configuration for the selected device and Karma target.',
      );
    }
    const parameters = configurationParameters(baseline.configuration);
    const previous = parameters.find((item) => item.parameterId === parameterId);
    let catalogId: string | null = null;
    if (kind === 'ADD_PARAMETER') {
      if (parameters.length >= 1000) {
        invalid(
          'parameterId',
          'The configuration has reached the supported readback capacity.',
          'CONFIGURATION_CAPACITY',
        );
      }
      if (!('catalogId' in input)) {
        invalid('catalogId', 'Choose a supported catalog preset.', 'UNSUPPORTED_VALUE');
      }
      catalogId = uuid(input.catalogId, 'catalogId');
      const eligible = (await this.operations.presets()).some(
        (preset) => preset.catalogId === catalogId && preset.parameterId === parameterId,
      );
      if (!eligible) {
        invalid(
          'parameterId',
          'Choose an unambiguous predefined Monitor catalog parameter.',
          'CATALOG_PARAMETER_UNSUPPORTED',
        );
      }
      if (previous) {
        throw new ConflictException('This parameter is already configured.');
      }
    } else {
      if (!previous) {
        throw new ConflictException('This parameter is absent from the confirmed configuration.');
      }
      if (previous.intervalSeconds === intervalSeconds) {
        invalid('intervalSeconds', 'Choose a different reporting interval.', 'VALUE_UNCHANGED');
      }
    }
    try {
      return deviceOperationResult(
        await this.operations.createWrite(
          scope,
          baseline,
          { kind, baselineOperationId, parameterId, intervalSeconds, catalogId },
          this.clock.now(),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A configuration operation for this Karma target is already active.',
        );
      }
      throw error;
    }
  }

  async find(context: RequestContext, id: string): Promise<FleetDeviceOperation | null> {
    const row = await this.operations.find(requireScope(context), uuid(id, 'id'));
    return row ? deviceOperationResult(row) : null;
  }

  async history(
    context: RequestContext,
    karmaCarId: string,
    expectedKarmaDeviceId: string,
  ): Promise<FleetDeviceOperation[]> {
    const scope = requireScope(context);
    const target = karmaTarget(karmaCarId, expectedKarmaDeviceId);
    return (await this.operations.history(scope, target)).map(deviceOperationResult);
  }

  async snapshot(
    context: RequestContext,
    karmaCarId: string,
    expectedKarmaDeviceId: string,
  ): Promise<FleetDeviceOperation | null> {
    const scope = requireScope(context);
    const target = karmaTarget(karmaCarId, expectedKarmaDeviceId);
    const row = await this.operations.lastComplete(scope, target);
    return row ? deviceOperationResult(row) : null;
  }

  async rulesSnapshot(
    context: RequestContext,
    karmaCarId: string,
    expectedKarmaDeviceId: string,
  ): Promise<FleetDeviceOperation | null> {
    const scope = requireScope(context);
    const target = karmaTarget(karmaCarId, expectedKarmaDeviceId);
    const row = await this.operations.lastCompleteRules(scope, target);
    return row ? deviceOperationResult(row) : null;
  }

  private async verifyTarget(target: { karmaCarId: string; karmaDeviceId: string }): Promise<void> {
    const current = await this.karma.target(target.karmaCarId);
    if (current.deviceId !== target.karmaDeviceId) {
      throw new ConflictException('The Karma device target has changed.');
    }
  }

  async request(
    context: RequestContext,
    input: RequestFleetDeviceConfigurationReadInput,
    kind: DeviceReadKind = 'READ_CONFIGURATION',
  ): Promise<FleetDeviceOperation> {
    const scope = requireScope(context);
    if (!deviceOperationsEnabled()) {
      throw new ServiceUnavailableException('Device configuration reading is disabled');
    }
    const target = karmaTarget(input.karmaCarId, input.expectedKarmaDeviceId);
    await this.core.requireBranch(scope.branchId, context);
    await this.verifyTarget(target);
    try {
      return deviceOperationResult(
        await this.operations.create(scope, target, this.clock.now(), kind),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A configuration read for this Karma target is already active.',
        );
      }
      throw error;
    }
  }
}

function karmaTarget(carId: string, expectedDeviceId: string) {
  const karmaCarId = text(carId, 'karmaCarId', 16);
  if (!/^[1-9][0-9]*$/.test(karmaCarId) || !Number.isSafeInteger(Number(karmaCarId))) {
    invalid('karmaCarId', 'Use a valid Karma car ID.', 'INVALID_FORMAT');
  }
  return {
    karmaCarId,
    karmaDeviceId: text(expectedDeviceId, 'expectedKarmaDeviceId', 128),
  };
}

export function deviceOperationsEnabled(): boolean {
  const value = process.env.FLEET_DEVICE_OPERATIONS_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_DEVICE_OPERATIONS_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

export function deviceConfigurationWritesEnabled(): boolean {
  const value = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED must be true or false');
  }
  return value === 'true' && deviceOperationsEnabled();
}
