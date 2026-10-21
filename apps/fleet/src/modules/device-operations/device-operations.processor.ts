import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import {
  KarmaDeviceReadError,
  KarmaDeviceReadsClient,
  KARMA_COMMAND_TIMEOUT_MS,
} from '../../integrations/karma/karma-device-reads.client.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';
import {
  deviceConfigurationWritesEnabled,
  deviceOperationsEnabled,
} from './device-operations.service.js';
import {
  changedDefinition,
  DEVICE_CONFIGURATION_FRESHNESS_MS,
  configurationParameters,
  evidenceWatermark,
  monitorDefinition,
  parameterConfiguration,
  sameConfiguration,
  verifyParameterChange,
} from './device-parameter-change.js';
import {
  mergeProfileEvidence,
  profileWatermark,
  resetProfileEvidence,
} from './device-profile-evidence.js';
import {
  DeviceReadEvidenceError,
  deviceReadEvidenceJson,
  mergeDeviceReadEvidence,
} from './device-read-evidence.js';

@Injectable()
export class DeviceOperationsProcessor {
  private readonly logger = new Logger(DeviceOperationsProcessor.name);
  constructor(
    private readonly operations: DeviceOperationsRepository,
    private readonly karma: KarmaDeviceReadsClient,
    private readonly clock: FleetClock,
  ) {}

  @Cron('*/10 * * * * *', { name: 'device-configuration-reads', waitForCompletion: true })
  async tick(): Promise<void> {
    if (!deviceOperationsEnabled()) {
      return;
    }
    try {
      // Each pass is bounded; the database retains all waiting work across restarts.
      for (let processed = 0; processed < 5; processed++) {
        const row = await this.operations.claim(this.clock.now());
        if (!row) {
          return;
        }
        await this.process(row);
      }
    } catch {
      this.logger.warn(
        'Device configuration read processing failed; persisted work will be revisited.',
      );
    }
  }

  async process(row: DeviceOperationRow): Promise<void> {
    const now = this.clock.now();
    if (row.deadlineAt <= now) {
      await this.operations.save(
        row,
        {
          status: 'TIMED_OUT',
          completedAt: now,
          errorCode: row.kind === 'READ_CONFIGURATION' ? 'READ_TIMEOUT' : 'WRITE_TIMEOUT',
        },
        now,
      );
      return;
    }
    if (!(await this.operations.currentDevice(row))) {
      await this.operations.save(
        row,
        { status: 'FAILED', completedAt: now, errorCode: 'LOCAL_DEVICE_CHANGED' },
        now,
      );
      return;
    }
    if (row.kind !== 'READ_CONFIGURATION') {
      await this.processWrite(row);
      return;
    }
    if (row.status === 'QUEUED') {
      await this.submit(row);
      return;
    }
    if (row.status === 'SUBMITTING') {
      // The previous holder may have sent the request. Never blindly resend after a crash.
      await this.operations.save(
        row,
        { status: 'UNKNOWN', errorCode: 'SUBMISSION_UNCERTAIN', nextCheckAt: now },
        now,
      );
      return;
    }
    try {
      const evidence = await this.karma.observations(
        row.karmaCarId,
        row.karmaDeviceId,
        row.dispatchedAt ?? row.requestedAt,
        now,
      );
      const currentDevice = await this.operations.currentDevice(row);
      const completedAt = this.clock.now();
      if (!currentDevice) {
        await this.operations.save(
          row,
          { status: 'FAILED', completedAt, errorCode: 'LOCAL_DEVICE_CHANGED' },
          completedAt,
        );
        return;
      }
      if (completedAt >= row.deadlineAt) {
        await this.operations.save(
          row,
          { status: 'TIMED_OUT', completedAt, errorCode: 'READ_TIMEOUT' },
          completedAt,
        );
        return;
      }
      const merged = mergeDeviceReadEvidence(row.observations, evidence);
      const observations = deviceReadEvidenceJson(merged.evidence);
      if (merged.status === 'CONFLICT') {
        await this.operations.save(
          row,
          { status: 'FAILED', completedAt, errorCode: 'READBACK_CONFLICT', observations },
          completedAt,
        );
      } else if (merged.status === 'COMPLETE') {
        await this.operations.save(
          row,
          {
            status: 'COMPLETE',
            completedAt,
            errorCode: null,
            observations,
            configurationId: merged.configurationId,
            configuration: merged.parameters.map((item) => ({
              parameterId: item.parameterId,
              intervalSeconds: item.reportingIntervalSeconds,
              definitionHex: item.rawDefinition,
            })),
          },
          completedAt,
        );
      } else {
        await this.operations.save(
          row,
          {
            observations,
            nextCheckAt: new Date(completedAt.getTime() + 10_000),
            errorCode: evidence.coverageComplete ? null : 'INCOMPLETE_HISTORY',
          },
          completedAt,
        );
      }
    } catch (error) {
      const failedAt = this.clock.now();
      const targetChanged =
        error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED';
      const evidenceError = error instanceof DeviceReadEvidenceError ? error.code : null;
      await this.operations.save(
        row,
        {
          ...(targetChanged || evidenceError ? { status: 'FAILED', completedAt: failedAt } : {}),
          errorCode: evidenceError ?? (targetChanged ? 'TARGET_CHANGED' : 'KARMA_UNAVAILABLE'),
          nextCheckAt: new Date(failedAt.getTime() + 10_000),
        },
        failedAt,
      );
    }
  }

  private async processWrite(row: DeviceOperationRow): Promise<void> {
    if (!row.writeDispatchedAt && !deviceConfigurationWritesEnabled()) {
      await this.fail(row, 'WRITE_DISABLED');
      return;
    }
    try {
      if (row.phase === 'WRITE_PARAMETER') {
        if (row.writeDispatchedAt || row.status === 'SUBMITTING') {
          // A crash between the durable marker and HTTP outcome is ambiguous. Read only.
          await this.verification(row, true);
        } else {
          await this.writeParameter(row);
        }
        return;
      }
      if (row.status === 'QUEUED') {
        await this.submitPhaseRead(row);
        return;
      }
      if (row.status === 'SUBMITTING') {
        await this.operations.save(
          row,
          { status: 'UNKNOWN', errorCode: 'SUBMISSION_UNCERTAIN', nextCheckAt: this.clock.now() },
          this.clock.now(),
        );
        return;
      }
      if (row.phase === 'READ_PROFILE') {
        await this.pollProfile(row);
      } else {
        await this.pollParameters(row);
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

  private async submitPhaseRead(row: DeviceOperationRow): Promise<void> {
    const now = this.clock.now();
    if (
      !(await this.operations.save(
        row,
        { status: 'SUBMITTING', dispatchedAt: row.dispatchedAt ?? now, phaseDispatchedAt: now },
        now,
        false,
      ))
    ) {
      return;
    }
    try {
      const result =
        row.phase === 'READ_PROFILE'
          ? await this.karma.requestProfile(row.karmaCarId, row.karmaDeviceId)
          : await this.karma.request(row.karmaCarId, row.karmaDeviceId);
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
      const targetChanged =
        error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED';
      await this.operations.save(
        row,
        {
          status: targetChanged ? 'FAILED' : 'UNKNOWN',
          ...(targetChanged ? { completedAt: savedAt } : {}),
          errorCode: targetChanged ? 'TARGET_CHANGED' : 'SUBMISSION_UNCERTAIN',
          nextCheckAt: new Date(savedAt.getTime() + 10_000),
        },
        savedAt,
      );
    }
  }

  private async pollProfile(row: DeviceOperationRow): Promise<void> {
    const response = await this.karma.profileObservations(
      row.karmaCarId,
      row.karmaDeviceId,
      row.phaseDispatchedAt ?? row.requestedAt,
      this.clock.now(),
      profileWatermark(row.profileObservations),
    );
    const result = mergeProfileEvidence(row.profileObservations, response);
    const now = this.clock.now();
    if (result.conflict) {
      await this.operations.save(
        row,
        {
          status: 'FAILED',
          completedAt: now,
          errorCode: 'PROFILE_CONFLICT',
          profileObservations: result.evidence,
        },
        now,
      );
      return;
    }
    if (result.profileId === null) {
      await this.operations.save(
        row,
        {
          profileObservations: result.evidence,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: response.coverageComplete ? null : 'INCOMPLETE_HISTORY',
        },
        now,
      );
      return;
    }
    const observedAt = result.observedAt
      ? new Date(
          Math.min(
            result.observedAt.getTime(),
            (row.phaseDispatchedAt ?? row.requestedAt).getTime(),
          ),
        )
      : null;
    if (!observedAt || now.getTime() - observedAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS) {
      await this.operations.save(
        row,
        {
          status: 'QUEUED',
          phaseDispatchedAt: null,
          profileObservations: resetProfileEvidence(result.evidence),
          nextCheckAt: now,
          errorCode: 'PROFILE_EXPIRED',
        },
        now,
      );
      return;
    }
    const preset = (await this.operations.presets()).find(
      (item) => item.catalogId === row.catalogId && item.parameterId === row.parameterId,
    );
    if (!preset?.profileIds.includes(result.profileId)) {
      await this.operations.save(
        row,
        {
          status: 'FAILED',
          completedAt: now,
          errorCode: 'PROFILE_UNSUPPORTED',
          profileId: result.profileId,
          profileObservations: result.evidence,
        },
        now,
      );
      return;
    }
    const savedAt = this.clock.now();
    await this.operations.save(
      row,
      {
        profileId: result.profileId,
        profileReadAt: observedAt,
        profileObservations: result.evidence,
        phase: 'READ_PARAMETERS',
        status: 'QUEUED',
        phaseDispatchedAt: null,
        observations: [],
        nextCheckAt: savedAt,
        errorCode: null,
      },
      savedAt,
    );
  }

  private async pollParameters(row: DeviceOperationRow): Promise<void> {
    const response = await this.karma.observations(
      row.karmaCarId,
      row.karmaDeviceId,
      row.phaseDispatchedAt ?? row.requestedAt,
      this.clock.now(),
      row.readAfterMessageId ?? undefined,
    );
    const result = mergeDeviceReadEvidence(row.observations, response);
    const observations = deviceReadEvidenceJson(result.evidence);
    if (!(await this.operations.currentDevice(row))) {
      await this.fail(row, 'LOCAL_DEVICE_CHANGED');
      return;
    }
    const now = this.clock.now();
    if (result.status === 'CONFLICT') {
      await this.operations.save(
        row,
        { status: 'FAILED', completedAt: now, observations, errorCode: 'READBACK_CONFLICT' },
        now,
      );
      return;
    }
    if (result.status !== 'COMPLETE') {
      await this.operations.save(
        row,
        {
          observations,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: response.coverageComplete ? null : 'INCOMPLETE_HISTORY',
        },
        now,
      );
      return;
    }
    if (now >= row.deadlineAt) {
      await this.operations.save(
        row,
        { status: 'TIMED_OUT', completedAt: now, observations, errorCode: 'WRITE_TIMEOUT' },
        now,
      );
      return;
    }
    const actual = parameterConfiguration(result.parameters);
    const baseline = configurationParameters(row.baselineConfiguration);
    if (row.phase === 'READ_PARAMETERS') {
      const observedAt = new Date(
        Math.min(
          (row.phaseDispatchedAt ?? row.requestedAt).getTime(),
          ...result.evidence.items.map((item) => Date.parse(item.eventTimeUtc)),
        ),
      );
      if (now.getTime() - observedAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS) {
        await this.operations.save(
          row,
          {
            status: 'QUEUED',
            phaseDispatchedAt: null,
            observations: [],
            baselineObservations: observations,
            baselineReadAt: observedAt,
            readAfterMessageId: evidenceWatermark(observations) ?? row.readAfterMessageId,
            nextCheckAt: now,
            errorCode: 'BASELINE_EXPIRED',
          },
          now,
        );
        return;
      }
      if (!sameConfiguration(baseline, actual)) {
        await this.operations.save(
          row,
          {
            status: 'FAILED',
            completedAt: now,
            baselineObservations: observations,
            errorCode: 'BASELINE_CHANGED',
          },
          now,
        );
        return;
      }
      if (row.parameterId === null || row.intervalSeconds === null) {
        throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
      }
      const previous = actual.find((item) => item.parameterId === row.parameterId);
      if (row.kind === 'ADD_PARAMETER' && actual.length >= 1000) {
        await this.fail(row, 'CONFIGURATION_CAPACITY');
        return;
      }
      if (
        (row.kind === 'ADD_PARAMETER' && previous) ||
        (row.kind === 'UPDATE_INTERVAL' && !previous)
      ) {
        await this.fail(row, 'BASELINE_CHANGED');
        return;
      }
      const definitionHex = previous
        ? changedDefinition(previous.definitionHex, row.intervalSeconds)
        : monitorDefinition(row.parameterId, row.intervalSeconds);
      await this.operations.save(
        row,
        {
          phase: 'WRITE_PARAMETER',
          status: 'QUEUED',
          baselineReadAt: observedAt,
          baselineObservations: observations,
          baselineConfigurationId: result.configurationId,
          definitionHex,
          readAfterMessageId: evidenceWatermark(observations) ?? row.readAfterMessageId,
          phaseDispatchedAt: null,
          observations: [],
          nextCheckAt: now,
          errorCode: null,
        },
        now,
      );
      return;
    }
    if (row.parameterId === null || !row.definitionHex || !row.writeDispatchedAt) {
      throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
    }
    const verified = verifyParameterChange(
      baseline,
      actual,
      row.parameterId,
      row.definitionHex,
      row.kind === 'ADD_PARAMETER',
    );
    if (verified === 'UNCHANGED') {
      // The write may still be queued. Advance beyond this complete old response and issue only a safe read.
      await this.operations.save(
        row,
        {
          status: 'QUEUED',
          observations: [],
          phaseDispatchedAt: null,
          readAfterMessageId: evidenceWatermark(observations) ?? row.readAfterMessageId,
          nextCheckAt: new Date(now.getTime() + 10_000),
          errorCode: 'WRITE_NOT_OBSERVED',
        },
        now,
      );
    } else if (verified === 'CONFLICT') {
      await this.operations.save(
        row,
        { status: 'FAILED', completedAt: now, observations, errorCode: 'VERIFICATION_CONFLICT' },
        now,
      );
    } else {
      await this.operations.save(
        row,
        {
          status: 'COMPLETE',
          completedAt: now,
          observations,
          configurationId: result.configurationId,
          configuration: actual.map((item) => ({ ...item })),
          errorCode: null,
        },
        now,
      );
    }
  }

  private async writeParameter(row: DeviceOperationRow): Promise<void> {
    const now = this.clock.now();
    if (!deviceConfigurationWritesEnabled()) {
      await this.fail(row, 'WRITE_DISABLED');
      return;
    }
    if (
      !row.baselineReadAt ||
      now.getTime() - row.baselineReadAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS
    ) {
      await this.operations.save(
        row,
        {
          phase: 'READ_PARAMETERS',
          status: 'QUEUED',
          phaseDispatchedAt: null,
          observations: [],
          nextCheckAt: now,
          errorCode: 'BASELINE_EXPIRED',
        },
        now,
      );
      return;
    }
    if (row.parameterId === null || row.intervalSeconds === null || !row.definitionHex) {
      throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
    }
    if (row.kind === 'ADD_PARAMETER') {
      if (
        !row.profileReadAt ||
        now.getTime() - row.profileReadAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS
      ) {
        await this.operations.save(
          row,
          {
            phase: 'READ_PROFILE',
            status: 'QUEUED',
            phaseDispatchedAt: null,
            profileObservations: resetProfileEvidence(row.profileObservations),
            observations: [],
            nextCheckAt: now,
            errorCode: 'PROFILE_EXPIRED',
          },
          now,
        );
        return;
      }
      const preset = (await this.operations.presets()).find(
        (item) => item.catalogId === row.catalogId && item.parameterId === row.parameterId,
      );
      if (row.profileId === null || !preset?.profileIds.includes(row.profileId)) {
        await this.fail(row, 'PROFILE_UNSUPPORTED');
        return;
      }
    }
    const dispatchedAt = this.clock.now();
    if (dispatchedAt >= row.deadlineAt) {
      await this.operations.save(
        row,
        { status: 'TIMED_OUT', completedAt: dispatchedAt, errorCode: 'WRITE_TIMEOUT' },
        dispatchedAt,
      );
      return;
    }
    if (
      dispatchedAt.getTime() + KARMA_COMMAND_TIMEOUT_MS - row.baselineReadAt.getTime() >
        DEVICE_CONFIGURATION_FRESHNESS_MS ||
      (row.kind === 'ADD_PARAMETER' &&
        (!row.profileReadAt ||
          dispatchedAt.getTime() + KARMA_COMMAND_TIMEOUT_MS - row.profileReadAt.getTime() >
            DEVICE_CONFIGURATION_FRESHNESS_MS))
    ) {
      await this.operations.save(
        row,
        {
          phase: row.kind === 'ADD_PARAMETER' ? 'READ_PROFILE' : 'READ_PARAMETERS',
          status: 'QUEUED',
          phaseDispatchedAt: null,
          profileObservations: resetProfileEvidence(row.profileObservations),
          observations: [],
          nextCheckAt: dispatchedAt,
          errorCode: 'BASELINE_EXPIRED',
        },
        dispatchedAt,
      );
      return;
    }
    if (
      !(await this.operations.save(
        row,
        { status: 'SUBMITTING', writeDispatchedAt: dispatchedAt },
        dispatchedAt,
        false,
      ))
    ) {
      return;
    }
    const beforeWire = this.clock.now().getTime();
    const wireBudgetEndsAt = beforeWire + KARMA_COMMAND_TIMEOUT_MS;
    if (
      !row.leaseUntil ||
      wireBudgetEndsAt >= row.leaseUntil.getTime() ||
      wireBudgetEndsAt >= row.deadlineAt.getTime() ||
      wireBudgetEndsAt - row.baselineReadAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS ||
      (row.kind === 'ADD_PARAMETER' &&
        (!row.profileReadAt ||
          wireBudgetEndsAt - row.profileReadAt.getTime() > DEVICE_CONFIGURATION_FRESHNESS_MS))
    ) {
      await this.verification(row, true);
      return;
    }
    try {
      const result = await this.karma.requestParameter(
        row.karmaCarId,
        row.karmaDeviceId,
        row.parameterId,
        row.intervalSeconds,
        row.definitionHex,
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
        phase: 'VERIFY_PARAMETERS',
        status: 'QUEUED',
        writeUncertain: uncertain,
        writeQueueIds: queueIds,
        phaseDispatchedAt: null,
        observations: [],
        nextCheckAt: now,
        errorCode: uncertain ? 'SUBMISSION_UNCERTAIN' : null,
      },
      now,
    );
  }

  private async submit(row: DeviceOperationRow): Promise<void> {
    const dispatchedAt = this.clock.now();
    if (
      !(await this.operations.save(
        row,
        { status: 'SUBMITTING', dispatchedAt },
        dispatchedAt,
        false,
      ))
    ) {
      return;
    }
    try {
      const submitted = await this.karma.request(row.karmaCarId, row.karmaDeviceId);
      const now = this.clock.now();
      await this.operations.save(
        row,
        {
          status: submitted.status === 'ACCEPTED' ? 'WAITING' : 'UNKNOWN',
          queueIds: submitted.queueIds,
          errorCode: submitted.status === 'ACCEPTED' ? null : 'SUBMISSION_UNCERTAIN',
          nextCheckAt: new Date(now.getTime() + 10_000),
        },
        now,
      );
    } catch (error) {
      const now = this.clock.now();
      const targetChanged =
        error instanceof KarmaDeviceReadError && error.code === 'TARGET_CHANGED';
      await this.operations.save(
        row,
        {
          status: targetChanged ? 'FAILED' : 'UNKNOWN',
          ...(targetChanged ? { completedAt: now } : {}),
          errorCode: targetChanged ? 'TARGET_CHANGED' : 'SUBMISSION_UNCERTAIN',
          nextCheckAt: new Date(now.getTime() + 10_000),
        },
        now,
      );
    }
  }
}
