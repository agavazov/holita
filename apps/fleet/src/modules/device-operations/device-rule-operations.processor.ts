import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import {
  KARMA_COMMAND_TIMEOUT_MS,
  KarmaDeviceReadError,
  KarmaDeviceReadsClient,
} from '../../integrations/karma/karma-device-reads.client.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';
import { deviceConfigurationWritesEnabled } from './device-operations.service.js';
import {
  DEVICE_CONFIGURATION_FRESHNESS_MS,
  configurationParameters,
  evidenceWatermark,
  parameterConfiguration,
  sameConfiguration,
} from './device-parameter-change.js';
import {
  DeviceReadEvidenceError,
  deviceReadEvidenceJson,
  mergeDeviceReadEvidence,
} from './device-read-evidence.js';
import { configurationRules, sameRules, verifyRuleChange } from './device-rule-change.js';
import { deviceRuleEvidenceJson, mergeDeviceRuleEvidence } from './device-rule-evidence.js';

/** Rule operations share Fleet's durable lease and single-write submission boundary. */
@Injectable()
export class DeviceRuleOperationsProcessor {
  constructor(
    private readonly operations: DeviceOperationsRepository,
    private readonly karma: KarmaDeviceReadsClient,
    private readonly clock: FleetClock,
  ) {}

  async process(row: DeviceOperationRow): Promise<void> {
    if (
      row.kind === 'UPSERT_RULE' &&
      !row.writeDispatchedAt &&
      !deviceConfigurationWritesEnabled()
    ) {
      await this.fail(row, 'WRITE_DISABLED');
      return;
    }
    try {
      if (row.phase === 'WRITE_RULE') {
        if (row.writeDispatchedAt || row.status === 'SUBMITTING') {
          await this.verification(row, true);
        } else {
          await this.write(row);
        }
      } else if (row.status === 'QUEUED') {
        await this.submitRead(row);
      } else if (row.status === 'SUBMITTING') {
        const now = this.clock.now();
        await this.operations.save(
          row,
          {
            status: 'UNKNOWN',
            errorCode: 'SUBMISSION_UNCERTAIN',
            nextCheckAt: now,
          },
          now,
        );
      } else if (row.phase === 'READ_PARAMETERS') {
        await this.pollParameters(row);
      } else {
        await this.pollRules(row);
      }
    } catch (error) {
      const now = this.clock.now();
      const targetChanged =
        error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED';
      const evidenceError = error instanceof DeviceReadEvidenceError ? error.code : null;
      await this.operations.save(
        row,
        {
          ...(targetChanged || evidenceError ? { status: 'FAILED', completedAt: now } : {}),
          errorCode: evidenceError ?? (targetChanged ? 'TARGET_CHANGED' : 'KARMA_UNAVAILABLE'),
          nextCheckAt: new Date(now.getTime() + 10_000),
        },
        now,
      );
    }
  }

  private async fail(row: DeviceOperationRow, errorCode: string): Promise<void> {
    const now = this.clock.now();
    await this.operations.save(row, { status: 'FAILED', completedAt: now, errorCode }, now);
  }

  private async submitRead(row: DeviceOperationRow): Promise<void> {
    const now = this.clock.now();
    if (
      !(await this.operations.save(
        row,
        {
          status: 'SUBMITTING',
          dispatchedAt: row.dispatchedAt ?? now,
          phaseDispatchedAt: now,
        },
        now,
        false,
      ))
    ) {
      return;
    }
    try {
      const result =
        row.phase === 'READ_PARAMETERS'
          ? await this.karma.request(row.karmaCarId, row.karmaDeviceId)
          : await this.karma.requestRules(row.karmaCarId, row.karmaDeviceId);
      const savedAt = this.clock.now();
      await this.operations.save(
        row,
        {
          status: result.status === 'ACCEPTED' ? 'WAITING' : 'UNKNOWN',
          queueIds: [...new Set([...row.queueIds, ...result.queueIds])].slice(-32),
          errorCode: result.status === 'ACCEPTED' ? null : 'SUBMISSION_UNCERTAIN',
          nextCheckAt: new Date(savedAt.getTime() + 10_000),
        },
        savedAt,
      );
    } catch (error) {
      const savedAt = this.clock.now();
      const changed = error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED';
      await this.operations.save(
        row,
        {
          status: changed ? 'FAILED' : 'UNKNOWN',
          ...(changed ? { completedAt: savedAt } : {}),
          errorCode: changed ? 'TARGET_CHANGED' : 'SUBMISSION_UNCERTAIN',
          nextCheckAt: new Date(savedAt.getTime() + 10_000),
        },
        savedAt,
      );
    }
  }

  private async canFinishRead(row: DeviceOperationRow): Promise<boolean> {
    const now = this.clock.now();
    if (now >= row.deadlineAt) {
      await this.operations.save(
        row,
        {
          status: 'TIMED_OUT',
          completedAt: now,
          errorCode: row.kind === 'READ_RULES' ? 'READ_TIMEOUT' : 'WRITE_TIMEOUT',
        },
        now,
      );
      return false;
    }
    return true;
  }

  private async pollParameters(row: DeviceOperationRow): Promise<void> {
    const response = await this.karma.observations(
      row.karmaCarId,
      row.karmaDeviceId,
      row.phaseDispatchedAt ?? row.requestedAt,
      this.clock.now(),
      row.readAfterMessageId ?? undefined,
    );
    if (!(await this.canFinishRead(row))) {
      return;
    }
    const result = mergeDeviceReadEvidence(row.observations, response);
    const evidence = deviceReadEvidenceJson(result.evidence);
    const now = this.clock.now();
    if (result.status === 'CONFLICT' || result.status === 'NO_CONFIGURATION') {
      await this.operations.save(
        row,
        {
          status: 'FAILED',
          completedAt: now,
          observations: evidence,
          errorCode: result.status === 'CONFLICT' ? 'READBACK_CONFLICT' : 'READ_NO_CONFIGURATION',
        },
        now,
      );
      return;
    }
    if (result.status !== 'COMPLETE') {
      await this.operations.save(
        row,
        {
          observations: evidence,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: response.coverageComplete ? null : 'INCOMPLETE_HISTORY',
        },
        now,
      );
      return;
    }
    const observedAt = new Date(
      Math.min(
        (row.phaseDispatchedAt ?? row.requestedAt).getTime(),
        ...result.evidence.items.map((item) => Date.parse(item.eventTimeUtc)),
      ),
    );
    if (
      !sameConfiguration(
        configurationParameters(row.baselineConfiguration),
        parameterConfiguration(result.parameters),
      )
    ) {
      await this.fail(row, 'BASELINE_CHANGED');
      return;
    }
    const nextRow = { ...row, observations: evidence };
    if (now.getTime() - observedAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS) {
      await this.restartPreflight(nextRow);
      return;
    }
    await this.operations.save(
      row,
      {
        phase: 'READ_RULES',
        status: 'QUEUED',
        phaseDispatchedAt: null,
        baselineReadAt: observedAt,
        baselineObservations: evidence,
        readAfterMessageId: evidenceWatermark(evidence) ?? row.readAfterMessageId,
        observations: [],
        nextCheckAt: now,
        errorCode: null,
      },
      now,
    );
  }

  private async pollRules(row: DeviceOperationRow): Promise<void> {
    const response = await this.karma.rulesObservations(
      row.karmaCarId,
      row.karmaDeviceId,
      row.phaseDispatchedAt ?? row.dispatchedAt ?? row.requestedAt,
      this.clock.now(),
      row.rulesAfterMessageId ?? undefined,
    );
    if (!(await this.canFinishRead(row))) {
      return;
    }
    const result = mergeDeviceRuleEvidence(row.rulesObservations, response);
    const evidence = deviceRuleEvidenceJson(result.evidence);
    const now = this.clock.now();
    if (result.status === 'CONFLICT' || result.status === 'NO_CONFIGURATION') {
      await this.operations.save(
        row,
        {
          status: 'FAILED',
          completedAt: now,
          rulesObservations: evidence,
          errorCode: result.status === 'CONFLICT' ? 'READBACK_CONFLICT' : 'READ_NO_CONFIGURATION',
        },
        now,
      );
      return;
    }
    if (result.status !== 'COMPLETE') {
      await this.operations.save(
        row,
        {
          rulesObservations: evidence,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: response.coverageComplete ? null : 'INCOMPLETE_HISTORY',
        },
        now,
      );
      return;
    }
    if (row.kind === 'READ_RULES') {
      await this.operations.save(
        row,
        {
          status: 'COMPLETE',
          completedAt: now,
          rulesObservations: evidence,
          rulesConfigurationId: result.configurationId,
          rules: result.rules.map((rule) => ({ ...rule })),
          errorCode: null,
        },
        now,
      );
      return;
    }
    const baseline = configurationRules(row.baselineRules);
    if (row.phase === 'READ_RULES') {
      const observedAt = new Date(
        Math.min(
          (row.phaseDispatchedAt ?? row.requestedAt).getTime(),
          ...result.evidence.items.map((item) => Date.parse(item.eventTimeUtc)),
        ),
      );
      if (!sameRules(baseline, result.rules)) {
        await this.operations.save(
          row,
          {
            status: 'FAILED',
            completedAt: now,
            rulesObservations: evidence,
            errorCode: 'BASELINE_CHANGED',
          },
          now,
        );
        return;
      }
      const ready = { ...row, rulesReadAt: observedAt, rulesObservations: evidence };
      if (!this.freshFor(ready, now.getTime())) {
        await this.restartPreflight(ready);
        return;
      }
      await this.operations.save(
        row,
        {
          phase: 'WRITE_RULE',
          status: 'QUEUED',
          phaseDispatchedAt: null,
          rulesReadAt: observedAt,
          rulesObservations: evidence,
          rulesAfterMessageId: evidenceWatermark(evidence) ?? row.rulesAfterMessageId,
          nextCheckAt: now,
          errorCode: null,
        },
        now,
      );
      return;
    }
    if (row.ruleId === null || !row.ruleDefinitionHex || !row.writeDispatchedAt) {
      throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
    }
    const verified = verifyRuleChange(baseline, result.rules, row.ruleId, row.ruleDefinitionHex);
    if (verified === 'UNCHANGED') {
      await this.operations.save(
        row,
        {
          status: 'QUEUED',
          phaseDispatchedAt: null,
          rulesObservations: [],
          rulesAfterMessageId: evidenceWatermark(evidence) ?? row.rulesAfterMessageId,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: 'WRITE_NOT_OBSERVED',
        },
        now,
      );
    } else if (verified === 'CONFLICT') {
      await this.operations.save(
        row,
        {
          status: 'FAILED',
          completedAt: now,
          rulesObservations: evidence,
          errorCode: 'VERIFICATION_CONFLICT',
        },
        now,
      );
    } else {
      await this.operations.save(
        row,
        {
          status: 'COMPLETE',
          completedAt: now,
          rulesObservations: evidence,
          rulesConfigurationId: result.configurationId,
          rules: result.rules.map((rule) => ({ ...rule })),
          errorCode: null,
        },
        now,
      );
    }
  }

  private freshFor(row: DeviceOperationRow, at: number): boolean {
    return (
      !!row.baselineReadAt &&
      !!row.rulesReadAt &&
      at - row.baselineReadAt.getTime() <= DEVICE_CONFIGURATION_FRESHNESS_MS &&
      at - row.rulesReadAt.getTime() <= DEVICE_CONFIGURATION_FRESHNESS_MS
    );
  }

  private async restartPreflight(row: DeviceOperationRow): Promise<void> {
    const now = this.clock.now();
    await this.operations.save(
      row,
      {
        phase: 'READ_PARAMETERS',
        status: 'QUEUED',
        phaseDispatchedAt: null,
        baselineReadAt: null,
        rulesReadAt: null,
        observations: [],
        rulesObservations: [],
        readAfterMessageId: evidenceWatermark(row.observations) ?? row.readAfterMessageId,
        rulesAfterMessageId: evidenceWatermark(row.rulesObservations) ?? row.rulesAfterMessageId,
        nextCheckAt: now,
        errorCode: 'BASELINE_EXPIRED',
      },
      now,
    );
  }

  private async write(row: DeviceOperationRow): Promise<void> {
    if (row.ruleId === null || !row.ruleDefinitionHex) {
      throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
    }
    const dispatchedAt = this.clock.now();
    if (!this.freshFor(row, dispatchedAt.getTime() + KARMA_COMMAND_TIMEOUT_MS)) {
      await this.restartPreflight(row);
      return;
    }
    if (
      !(await this.operations.save(
        row,
        {
          status: 'SUBMITTING',
          writeDispatchedAt: dispatchedAt,
        },
        dispatchedAt,
        false,
      ))
    ) {
      return;
    }
    const budgetEndsAt = this.clock.now().getTime() + KARMA_COMMAND_TIMEOUT_MS;
    if (
      !row.leaseUntil ||
      budgetEndsAt >= row.leaseUntil.getTime() ||
      budgetEndsAt >= row.deadlineAt.getTime() ||
      !this.freshFor(row, budgetEndsAt)
    ) {
      await this.verification(row, true);
      return;
    }
    try {
      const result = await this.karma.requestRule(
        row.karmaCarId,
        row.karmaDeviceId,
        row.ruleId,
        row.ruleDefinitionHex,
      );
      await this.verification(row, result.status === 'UNCERTAIN', result.queueIds);
    } catch (error) {
      if (error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED') {
        await this.fail(row, 'TARGET_CHANGED');
        return;
      }
      await this.verification(row, true);
    }
  }

  private async verification(
    row: DeviceOperationRow,
    uncertain: boolean,
    queueIds: string[] = row.writeQueueIds,
  ): Promise<void> {
    const now = this.clock.now();
    await this.operations.save(
      row,
      {
        phase: 'VERIFY_RULES',
        status: 'QUEUED',
        writeUncertain: uncertain,
        writeQueueIds: queueIds,
        phaseDispatchedAt: null,
        rulesObservations: [],
        nextCheckAt: now,
        errorCode: uncertain ? 'SUBMISSION_UNCERTAIN' : null,
      },
      now,
    );
  }
}
