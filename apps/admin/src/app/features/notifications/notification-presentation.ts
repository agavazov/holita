import type { AdminNotificationFragment } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import type { StatusTone } from '../../theme/status-tones';
import { interpolate } from '../../ui/i18n/messages';
import { faultsText } from '../../ui/fleet-live/fault-wording';
import { alertsText } from '../fleet/alerts/i18n/messages';
import { commandText } from '../fleet/commands/command-presentation';
import { notificationsText } from './i18n/messages';

export interface NotificationLink {
  readonly kind: 'vehicle' | 'device' | 'alert' | 'command';
  readonly label: string;
  readonly title: string;
  readonly url: string;
}

export interface NotificationRow {
  readonly id: string;
  readonly sentence: string;
  readonly sourceKey: string;
  readonly sourceKind: AdminNotificationFragment['sourceKind'];
  readonly category: AdminNotificationFragment['category'];
  readonly severity: AdminNotificationFragment['severity'];
  readonly occurredAt: string;
  readonly unread: boolean;
  readonly links: readonly NotificationLink[];
  readonly sourceLink: { readonly label: string; readonly url: string } | null;
}

function translated(
  catalog: Readonly<Record<string, string>>,
  code: string | null | undefined,
  fallback: string,
): string {
  return Object.entries(catalog).find(([key]) => key === code)?.[1] ?? fallback;
}

function clause(value: string): string {
  return value.replace(/[.!?]+$/u, '');
}

/** Wording describes the source fact; recorded diagnostics never imply a current fault. */
export function notificationSentence(
  notification: AdminNotificationFragment,
  language: Language,
): string {
  const text = notificationsText(language).wording;
  const parameters = notification.parameters;
  if (isLampNotification(notification)) {
    const faults = faultsText(language);
    return interpolate(
      notification.wordingKey === 'notification.warningLampOff'
        ? text.warningLampOff
        : text.warningLampEntered,
      {
        lamp: translated(faults.lamps, parameters.lamp, faults.lamp),
        state: translated(faults.states, parameters.state, faults.states.UNKNOWN),
        previousState: translated(faults.states, parameters.previousState, faults.states.UNKNOWN),
      },
    );
  }
  if (
    parameters.eventKind === 'CONFIGURATION_OUTCOME' ||
    notification.wordingKey === 'notification.configurationOutcome'
  ) {
    return interpolate(text.configurationOutcome, {
      operation: translated(
        text.configurationOperations,
        parameters.commandKind,
        text.unknownConfiguration,
      ),
      outcome: translated(text.configurationStates, parameters.commandStatus, text.unknownOutcome),
    });
  }
  if (
    parameters.eventKind === 'PARAMETER_SNAPSHOT_OUTCOME' ||
    notification.wordingKey === 'notification.snapshotOutcome'
  ) {
    return interpolate(text.snapshotOutcome, {
      outcome: translated(text.snapshotStates, parameters.commandStatus, text.unknownOutcome),
      reason: parameters.reasonCode
        ? interpolate(text.reasonSuffix, {
            reason: translated(
              text.snapshotReasons,
              parameters.reasonCode,
              text.snapshotReasons.SNAPSHOT_FAILED,
            ),
          })
        : '',
    });
  }
  switch (notification.sourceKind) {
    case 'FLEET_ALERT':
      return interpolate(text.alert, {
        event: translated(alertsText(language).kinds, parameters.eventKind, text.unknownEvent),
        transition: translated(
          text.transitions,
          parameters.transition ?? parameters.alertStatus,
          text.unknownTransition,
        ),
      });
    case 'DIAGNOSTIC':
      if (parameters.troubleCode) {
        return interpolate(text.recordedFault, {
          code: parameters.troubleCode,
          status: translated(
            text.diagnosticStatuses,
            parameters.diagnosticStatus,
            text.unknownDiagnosticStatus,
          ),
        });
      }
      if (parameters.eventKind === 'CAN_ERROR') {
        return text.recordedCanError;
      }
      return interpolate(text.recordedDiagnostic, {
        code: parameters.alarmCode
          ? interpolate(text.codeSuffix, { code: parameters.alarmCode })
          : '',
      });
    case 'ALARM': {
      const event = translated(alertsText(language).kinds, parameters.alarmCode, '');
      return interpolate(text.recordedAlarm, {
        event: event ? interpolate(text.eventSuffix, { event }) : '',
      });
    }
    case 'COMMAND': {
      const commands = commandText[language];
      return interpolate(text.command, {
        command: translated(commands.purposes, parameters.commandKind, commands.unknownPurpose),
        outcome: clause(
          translated(commands.outcomes, parameters.commandStatus, commands.unknownOutcome),
        ),
        reason: parameters.reasonCode
          ? interpolate(text.reasonSuffix, {
              reason: clause(
                translated(commands.reasons, parameters.reasonCode, commands.unknownReason),
              ),
            })
          : '',
      });
    }
  }
}

export function notificationTone(severity: NotificationRow['severity']): StatusTone {
  return severity === 'CRITICAL' ? 'danger' : severity === 'WARNING' ? 'warn' : 'info';
}

function isLampNotification(notification: AdminNotificationFragment): boolean {
  return (
    notification.wordingKey === 'notification.warningLampEntered' ||
    notification.wordingKey === 'notification.warningLampOff'
  );
}

export function notificationIcon(category: NotificationRow['category']) {
  return category === 'ALERT'
    ? 'exclamation-triangle'
    : category === 'DEVICE'
      ? 'microchip'
      : 'send';
}

export function notificationRow(
  notification: AdminNotificationFragment,
  language: Language,
  branchId: string,
): NotificationRow {
  const text = notificationsText(language);
  const base = `/${language}/${branchId}/fleet`;
  const links: NotificationLink[] = [];
  const lampNotification = isLampNotification(notification);
  const vehicleId = notification.vehicleId ?? notification.parameters.vehicleId;
  const deviceId = notification.deviceId ?? notification.parameters.deviceId;
  function add(kind: NotificationLink['kind'], id: string, url: string): void {
    links.push({ kind, label: text.targets[kind], title: `${text.targets[kind]} ${id}`, url });
  }
  if (vehicleId) {
    add(
      'vehicle',
      vehicleId,
      `${base}/vehicles/${vehicleId}/${lampNotification ? 'problems' : 'overview'}`,
    );
  }
  if (deviceId) {
    add('device', deviceId, `${base}/devices/${deviceId}/overview`);
  }
  if (notification.alertId) {
    add('alert', notification.alertId, `${base}/dashboard/problems/${notification.alertId}`);
  }
  if (notification.deviceId && notification.commandRequestId) {
    add(
      'command',
      notification.commandRequestId,
      `${base}/devices/${notification.deviceId}/commands?request=${encodeURIComponent(notification.commandRequestId)}`,
    );
  }
  let outcomeSourceLink: NotificationRow['sourceLink'] = null;
  if (notification.deviceId) {
    const url = `${base}/devices/${notification.deviceId}/parameters`;
    if (
      notification.parameters.eventKind === 'CONFIGURATION_OUTCOME' ||
      notification.wordingKey === 'notification.configurationOutcome'
    ) {
      outcomeSourceLink = { label: text.configurationSource, url };
    } else if (
      notification.parameters.eventKind === 'PARAMETER_SNAPSHOT_OUTCOME' ||
      notification.wordingKey === 'notification.snapshotOutcome'
    ) {
      outcomeSourceLink = { label: text.snapshotSource, url };
    }
  }
  const primary = links.find((link) =>
    lampNotification && vehicleId
      ? link.kind === 'vehicle'
      : notification.sourceKind === 'FLEET_ALERT'
        ? link.kind === 'alert'
        : notification.sourceKind === 'COMMAND'
          ? link.kind === 'command'
          : link.kind === 'device',
  );
  return {
    id: notification.id,
    sentence: notificationSentence(notification, language),
    sourceKey: notification.sourceKey,
    sourceKind: notification.sourceKind,
    category: notification.category,
    severity: notification.severity,
    occurredAt: notification.occurredAt,
    unread: notification.readAt === null,
    links,
    sourceLink:
      outcomeSourceLink ??
      (primary
        ? {
            label: text.sources[notification.sourceKind],
            url: lampNotification
              ? primary.url
              : (notification.sourceKind === 'DIAGNOSTIC' || notification.sourceKind === 'ALARM') &&
                  deviceId
                ? `${base}/devices/${deviceId}/problems`
                : primary.url,
          }
        : null),
  };
}
