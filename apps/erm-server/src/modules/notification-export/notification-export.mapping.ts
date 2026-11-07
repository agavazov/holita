import type {
  ErmCommandRequest,
  ErmConfigurationChange,
  ErmKarmaRouting,
  ErmParameterSnapshot,
} from '../../generated/prisma/client.js';
import type { ErmCommand } from '../../generated/graphql/types.js';
import { starlinkEvents } from '../../starlink/event-catalog.js';
import { commandRequestView } from '../telemetry/command-request-view.js';
import type { NotificationExportEvent } from './notification-export.repository.js';
import type {
  NotificationExportItem,
  NotificationExportScope,
} from './notification-export.types.js';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function eventNotifications(
  event: NotificationExportEvent,
  scope: NotificationExportScope,
): NotificationExportItem[] {
  const edata =
    record(event.fields) && record(event.fields['edata']) ? event.fields['edata'] : null;
  const target = { kind: 'DEVICE' as const, id: scope.deviceId };
  const common = {
    sourceId: event.id,
    occurredAt: event.occurredAt.toISOString(),
    target,
    recorded: true,
  };
  const diagnostic = (
    eventKind: string,
    troubleCode: string | null,
    diagnosticStatus: string | null,
    severity: NotificationExportItem['severity'],
  ): NotificationExportItem => ({
    ...common,
    sourceKind: 'DIAGNOSTIC',
    sourceKey: JSON.stringify([
      scope.imei,
      (event.eventTime ?? event.occurredAt).toISOString(),
      eventKind,
      troubleCode,
      diagnosticStatus,
    ]),
    severity,
    wordingKey: 'notification.recordedDiagnostic',
    parameters: { eventKind, troubleCode, diagnosticStatus, alarmCode: event.eventId },
  });
  if (edata?.['type'] === 419 && Array.isArray(edata['faults'])) {
    return edata['faults'].flatMap((fault: unknown) => {
      if (
        !record(fault) ||
        typeof fault['spn'] !== 'number' ||
        typeof fault['fmi'] !== 'number' ||
        (fault['status'] !== 1 && fault['status'] !== 2)
      ) {
        return [];
      }
      return [
        diagnostic(
          'DIAGNOSTIC_TROUBLE_CODE',
          `SPN ${String(fault['spn'])} FMI ${String(fault['fmi'])}`,
          fault['status'] === 1 ? 'ADDED' : 'DELETED',
          fault['status'] === 1 ? 'WARNING' : 'INFO',
        ),
      ];
    });
  }
  if (edata?.['type'] === 411 && typeof edata['canError'] === 'number' && edata['canError'] !== 0) {
    return [diagnostic('CAN_ERROR', null, null, 'WARNING')];
  }
  const sourceKind = ['02', '70', '89'].includes(event.eventId ?? '') ? 'DIAGNOSTIC' : 'ALARM';
  return [
    {
      ...common,
      sourceKind,
      sourceKey: `erm-event:${event.id}`,
      severity: starlinkEvents.get(event.eventId ?? '')?.severity ?? 'INFO',
      wordingKey:
        sourceKind === 'DIAGNOSTIC'
          ? 'notification.recordedDiagnostic'
          : 'notification.recordedAlarm',
      parameters: {
        eventKind: sourceKind === 'DIAGNOSTIC' ? 'DEVICE_DIAGNOSTIC' : 'DEVICE_ALARM',
        alarmCode: event.eventId,
      },
    },
  ];
}

export function commandNotification(
  request: ErmCommandRequest,
  commands: Map<string, ErmCommand>,
): NotificationExportItem {
  const view = commandRequestView(request, {
    commands,
    frames: new Map(),
    configurations: new Map(),
  });
  if (request.completedAt === null) {
    throw new Error('Terminal command notification requires completion time');
  }
  return {
    sourceKind: 'COMMAND',
    sourceKey: `erm-command:${request.id}:${view.outcomeCode}`,
    sourceId: request.id,
    occurredAt: request.completedAt.toISOString(),
    severity: request.status === 'ANSWERED' ? 'INFO' : 'WARNING',
    wordingKey: 'notification.commandOutcome',
    parameters: {
      commandKind: request.action,
      commandStatus: view.outcomeCode,
      reasonCode: view.reasonCode ?? null,
    },
    target: { kind: 'DEVICE', id: request.deviceId },
    recorded: false,
  };
}

export function karmaRoutingNotification(
  routing: ErmKarmaRouting,
  scope: NotificationExportScope,
): NotificationExportItem {
  return {
    sourceKind: 'DIAGNOSTIC',
    sourceKey: `karma-routing:${routing.id.toString()}`,
    sourceId: `karma-routing:${routing.id.toString()}`,
    occurredAt: routing.createdAt.toISOString(),
    severity: routing.notificationKind === 'UNIT_ON_BACKUP' ? 'WARNING' : 'INFO',
    wordingKey: 'notification.recordedDiagnostic',
    parameters: { eventKind: routing.notificationKind },
    target: { kind: 'DEVICE', id: scope.deviceId },
    recorded: true,
  };
}

export function configurationNotification(
  change: ErmConfigurationChange,
  scope: NotificationExportScope,
): NotificationExportItem {
  if (change.finishedAt === null) {
    throw new Error('Terminal configuration notification requires completion time');
  }
  return {
    sourceKind: 'COMMAND',
    sourceKey: `erm-configuration:${change.id}:${change.status}`,
    sourceId: `configuration:${change.id}`,
    occurredAt: change.finishedAt.toISOString(),
    severity: change.status === 'RESTORE_FAILED' ? 'CRITICAL' : 'WARNING',
    wordingKey: 'notification.configurationOutcome',
    parameters: {
      eventKind: 'CONFIGURATION_OUTCOME',
      commandKind: change.operation,
      commandStatus: change.status,
      reasonCode: change.status,
    },
    target: { kind: 'DEVICE', id: scope.deviceId },
    recorded: false,
  };
}

export function snapshotNotification(
  snapshot: ErmParameterSnapshot,
  scope: NotificationExportScope,
): NotificationExportItem {
  if (snapshot.finishedAt === null) {
    throw new Error('Terminal snapshot notification requires completion time');
  }
  const reasons: Readonly<Record<string, string>> = {
    'interrupted by an api restart': 'SNAPSHOT_INTERRUPTED',
    'Unit is not connected in primary mode or is busy': 'PRIMARY_REQUIRED',
    'Parameter read timed out': 'PARAMETER_READ_TIMEOUT',
    'Parameter read failed': 'PARAMETER_READ_FAILED',
    'ERM gateway is unavailable': 'GATEWAY_UNAVAILABLE',
  };
  const status = snapshot.status === 'COMPLETE' ? 'PARTIAL' : snapshot.status;
  return {
    sourceKind: 'COMMAND',
    sourceKey: `erm-snapshot:${snapshot.id}:${status}`,
    sourceId: `snapshot:${snapshot.id}`,
    occurredAt: snapshot.finishedAt.toISOString(),
    severity: 'WARNING',
    wordingKey: 'notification.snapshotOutcome',
    parameters: {
      eventKind: 'PARAMETER_SNAPSHOT_OUTCOME',
      commandKind: 'PARAMETER_SNAPSHOT',
      commandStatus: status,
      reasonCode:
        status === 'PARTIAL'
          ? 'UNREAD_PARAMETERS'
          : (reasons[snapshot.failureReason ?? ''] ?? 'SNAPSHOT_FAILED'),
    },
    target: { kind: 'DEVICE', id: scope.deviceId },
    recorded: false,
  };
}
