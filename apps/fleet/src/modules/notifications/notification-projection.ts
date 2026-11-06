import type { FleetEvent, Prisma } from '../../generated/prisma/client.js';
import type { ErmTelemetryEvent } from '../../integrations/erm/erm-telemetry.client.js';
import type { ErmTelemetryDevice } from '../erm-telemetry/erm-telemetry.mapping.js';

export type AlertNotificationTransition = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'REOPENED';

export function alertNotification(
  event: FleetEvent,
  transition: AlertNotificationTransition,
  occurredAt: Date,
  createdAt: Date,
): Prisma.FleetNotificationCreateManyInput {
  return {
    tenantId: event.tenantId,
    branchId: event.branchId,
    sourceKind: 'FLEET_ALERT',
    sourceKey: `${event.id}:${transition}:${occurredAt.toISOString()}`,
    category: 'ALERT',
    severity: event.severity,
    occurredAt,
    createdAt,
    wordingKey: 'fleet.alert.transition',
    parameters: {
      eventKind: event.kind,
      alertStatus: transition === 'REOPENED' ? 'OPEN' : transition,
      transition,
      troubleCode: event.troubleCode,
    },
    vehicleId: event.vehicleId,
    alertId: event.id,
  };
}

/** The same diagnostic identity is used by the retained ERM export and the imported view. */
export function recordedDiagnosticNotifications(
  device: ErmTelemetryDevice,
  events: ErmTelemetryEvent[],
  since: Date,
  createdAt: Date,
): Prisma.FleetNotificationCreateManyInput[] {
  const rows: Prisma.FleetNotificationCreateManyInput[] = [];
  for (const event of events) {
    if (
      event.eventTime === null ||
      event.eventTime < since ||
      event.receivedAt < device.createdAt
    ) {
      continue;
    }
    const diagnostics =
      event.edata?.report === '419'
        ? event.edata.faults.map((fault) => ({
            kind: 'DIAGNOSTIC_TROUBLE_CODE',
            troubleCode: `SPN ${String(fault.spn)} FMI ${String(fault.fmi)}`,
            status: fault.status,
          }))
        : event.edata?.report === '411' && event.edata.canError
          ? [{ kind: 'CAN_ERROR', troubleCode: null, status: null }]
          : [];
    for (const diagnostic of diagnostics) {
      rows.push({
        tenantId: device.tenantId,
        branchId: device.branchId,
        sourceKind: 'DIAGNOSTIC',
        sourceKey: JSON.stringify([
          device.imei,
          event.eventTime.toISOString(),
          diagnostic.kind,
          diagnostic.troubleCode,
          diagnostic.status,
        ]),
        category: 'DEVICE',
        severity: diagnostic.status === 'DELETED' ? 'INFO' : 'WARNING',
        occurredAt: event.eventTime,
        createdAt,
        wordingKey: 'notification.recordedDiagnostic',
        parameters: {
          eventKind: diagnostic.kind,
          troubleCode: diagnostic.troubleCode,
          diagnosticStatus: diagnostic.status,
          alarmCode: event.eventId,
        },
        deviceId: device.id,
        vehicleId:
          event.receivedAt >= (device.installedAt ?? device.createdAt) ? device.vehicleId : null,
        ermEventId: event.id.toString(),
      });
    }
  }
  return rows;
}
