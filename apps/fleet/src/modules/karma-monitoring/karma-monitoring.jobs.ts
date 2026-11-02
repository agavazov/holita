import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  KarmaMonitoringSettings,
  KarmaMonitoringTruck,
} from '../../generated/prisma/client.js';
import type {
  FleetKarmaMonitoringCommandOutcome,
  FleetDeviceOperation,
} from '../../generated/graphql/types.js';
import type { FleetScope } from '../../validation.js';
import {
  DeviceOperationsService,
  deviceOperationsEnabled,
} from '../device-operations/device-operations.service.js';
import {
  KarmaMonitoringRepository,
  type MonitoringEventData,
} from './karma-monitoring.repository.js';
import { KarmaMonitoringSourceService } from './karma-monitoring-source.service.js';

function due(last: Date | null, seconds: number, now: Date) {
  return last === null || now.getTime() - last.getTime() >= seconds * 1000;
}

function commandOutcome(operation: FleetDeviceOperation): FleetKarmaMonitoringCommandOutcome {
  const supportedFaults = operation.diagnosticObservations.some((observation) => {
    const parts = observation.rawMessage.split(',');
    const payload = parts[7] ?? '';
    return (
      observation.family === 'FAULT_REPORT' &&
      ((parts[2] === '413' && /^19(?:[A-F\d]{6})+$/i.test(payload)) ||
        (parts[2] === '419' && /^21(?:[A-F\d]{12})+$/i.test(payload)))
    );
  });
  if (supportedFaults) {
    return 'FAULTS';
  }
  if (
    operation.diagnosticObservations.some((observation) => observation.acknowledgement === 'NACK')
  ) {
    return 'NOT_ACKNOWLEDGED';
  }
  // A type byte alone or an unrecognized report does not establish an empty logger.
  return operation.status === 'COMPLETE' ? 'UNRESOLVED' : 'FAILED';
}

export function karmaMonitoringEnabled() {
  const value = process.env.FLEET_KARMA_MONITORING_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_KARMA_MONITORING_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

@Injectable()
export class KarmaMonitoringJobs {
  private readonly logger = new Logger(KarmaMonitoringJobs.name);
  constructor(
    private readonly repository: KarmaMonitoringRepository,
    private readonly source: KarmaMonitoringSourceService,
    private readonly operations: DeviceOperationsService,
    private readonly clock: FleetClock,
  ) {}

  @Cron('*/10 * * * * *', { name: 'karma-pull-monitoring', waitForCompletion: true })
  async tick(): Promise<void> {
    if (!karmaMonitoringEnabled()) {
      return;
    }
    try {
      for (const settings of await this.repository.branches()) {
        try {
          await this.runBranch(settings, this.clock.now());
        } catch {
          this.logger.warn(
            'Karma monitoring Branch processing failed; stored work will be revisited.',
          );
        }
      }
    } catch {
      this.logger.warn('Karma monitoring settings could not be read.');
    }
  }

  async runBranch(settings: KarmaMonitoringSettings, now: Date) {
    const scope = { tenantId: settings.tenantId, branchId: settings.branchId };
    if (settings.enabled && due(settings.lastStatusPollAt, settings.statusPollSeconds, now)) {
      await this.repository.markSettings(scope, { lastStatusPollAt: now });
      try {
        const latest = await this.source.status();
        for (const truck of latest) {
          await this.repository.observe(scope, truck, settings.offlineAfterMinutes, now);
        }
        // Removed/inaccessible cars retain their last observation and still age into no-data state.
        const present = new Set(latest.map((truck) => truck.karmaCarId));
        for (const truck of await this.repository.trucks(scope)) {
          if (!present.has(truck.karmaCarId)) {
            await this.repository.observe(scope, truck, settings.offlineAfterMinutes, now);
          }
        }
      } catch {
        await this.pollFailed(scope, null, 'STATUS_POLL', now);
        for (const truck of await this.repository.trucks(scope)) {
          await this.repository.observe(scope, truck, settings.offlineAfterMinutes, now);
        }
      }
    }
    for (const truck of await this.repository.trucks(scope)) {
      await this.reconcile(scope, truck, now);
      if (!settings.enabled) {
        continue;
      }
      if (due(truck.lastHistoryPollAt, settings.faultHistoryPollMinutes * 60, now)) {
        await this.history(scope, truck, settings.retentionDays, now);
      }
      const online =
        truck.lastDataAt !== null &&
        truck.lastDataAt.getTime() > now.getTime() - settings.offlineAfterMinutes * 60_000;
      if (
        online &&
        settings.faultCommandEnabled &&
        deviceOperationsEnabled() &&
        !truck.lastCommandOperationId &&
        due(truck.lastCommandRequestedAt, settings.faultCommandMinutes * 60, now)
      ) {
        try {
          const operation = await this.operations.requestMonitoringFaultRead(
            scope,
            truck.karmaCarId,
            truck.karmaDeviceId,
          );
          if (operation) {
            await this.repository.updateTruck(scope, truck.karmaCarId, {
              lastCommandOperationId: operation.id,
              lastCommandRequestedAt: operation.requestedAt,
              lastCommandCompletedAt: null,
              lastCommandOutcome: null,
            });
            await this.repository.record(scope, [
              {
                karmaCarId: truck.karmaCarId,
                kind: 'FAULT_READ_REQUESTED',
                source: 'DEVICE_COMMAND',
                sourceKey: `${operation.id}:requested`,
                occurredAt: operation.requestedAt,
                recordedAt: now,
                operationId: operation.id,
              },
            ]);
          }
        } catch {
          await this.repository.updateTruck(scope, truck.karmaCarId, {
            lastCommandRequestedAt: now,
            lastCommandCompletedAt: now,
            lastCommandOutcome: 'FAILED',
          });
          await this.pollFailed(scope, truck.karmaCarId, 'DEVICE_COMMAND', now);
        }
      }
    }
    // Retention and pending-read reconciliation also run for disabled Branches.
    if (due(settings.lastRetentionAt, 86400, now)) {
      const cutoff = new Date(now.getTime() - settings.retentionDays * 86_400_000);
      await this.repository.prune(scope, cutoff);
      await this.operations.pruneMonitoring(scope, cutoff);
      await this.repository.markSettings(scope, { lastRetentionAt: now });
    }
  }

  private async history(
    scope: FleetScope,
    truck: KarmaMonitoringTruck,
    retentionDays: number,
    now: Date,
  ) {
    try {
      const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
      const batch = await this.source.history(truck, cutoff, now);
      const highWatermark = String(
        Math.max(
          Number(truck.historyHighWatermark ?? truck.historyCursor),
          Number(batch.highWatermark),
        ),
      );
      const events: MonitoringEventData[] = batch.reports.flatMap<MonitoringEventData>((report) => {
        if (
          !['413', '418', '419'].includes(report.reportCode) ||
          report.occurredAt === null ||
          report.occurredAt < cutoff
        ) {
          return [];
        }
        const base = {
          karmaCarId: truck.karmaCarId,
          source: 'KARMA_HISTORY' as const,
          occurredAt: report.occurredAt,
          recordedAt: now,
          rawRecord: report.rawRecord,
        };
        const faults =
          report.decoding === 'DECODED'
            ? report.faults.flatMap((fault, index) =>
                fault.code || (fault.spn !== null && fault.fmi !== null)
                  ? [
                      {
                        ...fault,
                        sourceKey: `${truck.karmaCarId}:${report.messageId}:${String(index)}`,
                      },
                    ]
                  : [],
              )
            : [];
        return faults.length
          ? faults.map((fault) => ({ ...base, ...fault, kind: 'FAULT_REPORTED' as const }))
          : [
              {
                ...base,
                kind: 'FAULT_REPORT_UNDECODED',
                sourceKey: `${truck.karmaCarId}:${report.messageId}:undecoded`,
                details: `Source fault report ${report.reportCode} decoding: ${report.decoding}.`,
              },
            ];
      });
      await this.repository.saveHistory(scope, truck.karmaCarId, events, {
        historyCursor: batch.nextBeforeId === null ? highWatermark : truck.historyCursor,
        historyBeforeId: batch.nextBeforeId,
        historyHighWatermark: batch.nextBeforeId === null ? null : highWatermark,
        // Continue a bounded catch-up page on the next tick, then return to the configured interval.
        lastHistoryPollAt: batch.nextBeforeId === null ? now : null,
      });
    } catch {
      await this.repository.updateTruck(scope, truck.karmaCarId, { lastHistoryPollAt: now });
      await this.pollFailed(scope, truck.karmaCarId, 'KARMA_HISTORY', now);
    }
  }

  private async reconcile(scope: FleetScope, truck: KarmaMonitoringTruck, now: Date) {
    if (!truck.lastCommandOperationId) {
      return;
    }
    const operation = await this.operations.monitoringOperation(
      scope,
      truck.lastCommandOperationId,
    );
    if (!operation) {
      await this.repository.record(scope, [
        {
          karmaCarId: truck.karmaCarId,
          source: 'DEVICE_COMMAND',
          sourceKey: `${truck.lastCommandOperationId}:finished`,
          kind: 'FAULT_READ_FAILED',
          occurredAt: now,
          recordedAt: now,
          operationId: truck.lastCommandOperationId,
          commandOutcome: 'FAILED',
          details: 'The pending monitoring operation is no longer retained.',
        },
      ]);
      await this.repository.updateTruck(scope, truck.karmaCarId, {
        lastCommandOperationId: null,
        lastCommandCompletedAt: now,
        lastCommandOutcome: 'FAILED',
      });
      return;
    }
    if (!['COMPLETE', 'FAILED', 'TIMED_OUT'].includes(operation.status)) {
      return;
    }
    const outcome = commandOutcome(operation);
    await this.repository.record(scope, [
      {
        karmaCarId: truck.karmaCarId,
        source: 'DEVICE_COMMAND',
        sourceKey: `${operation.id}:finished`,
        kind: outcome === 'FAILED' ? 'FAULT_READ_FAILED' : 'FAULT_READ_ANSWERED',
        occurredAt: operation.completedAt ?? now,
        recordedAt: now,
        operationId: operation.id,
        commandOutcome: outcome,
        details: operation.errorCode ?? null,
        rawRecord: {
          status: operation.status,
          observations: operation.diagnosticObservations.map((observation) => ({
            ...observation,
            eventTimeUtc: observation.eventTimeUtc.toISOString(),
          })),
        },
      },
    ]);
    await this.repository.updateTruck(scope, truck.karmaCarId, {
      lastCommandOperationId: null,
      lastCommandCompletedAt: operation.completedAt ?? now,
      lastCommandOutcome: outcome,
    });
  }

  private async pollFailed(
    scope: FleetScope,
    karmaCarId: string | null,
    source: 'STATUS_POLL' | 'KARMA_HISTORY' | 'DEVICE_COMMAND',
    now: Date,
  ) {
    await this.repository.record(scope, [
      {
        karmaCarId,
        kind: source === 'DEVICE_COMMAND' ? 'FAULT_READ_FAILED' : 'POLL_FAILED',
        ...(source === 'DEVICE_COMMAND' ? { commandOutcome: 'FAILED' as const } : {}),
        source,
        sourceKey: `${karmaCarId ?? 'branch'}:${now.toISOString()}`,
        occurredAt: now,
        recordedAt: now,
        details: 'Karma monitoring request failed; no successful or empty result is inferred.',
      },
    ]);
  }
}
