import type { FleetEvent, Prisma } from '../../generated/prisma/client.js';
import type { DeviceReport } from '@discocan/device-contract';
import { legacyFaultPrefix, storedDiagnosticStatus } from '../../database/device-diagnostics.js';
import type { TelemetryDevice } from '../device-telemetry/device-telemetry.mapping.js';

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

/** The same diagnostic identity is used by the device export and the imported view. */
export function recordedDiagnosticNotifications(
  device: TelemetryDevice,
  reports: DeviceReport[],
  since: Date,
  createdAt: Date,
): Prisma.FleetNotificationCreateManyInput[] {
  const rows: Prisma.FleetNotificationCreateManyInput[] = [];
  for (const event of reports) {
    if (
      event.recordedAt === null ||
      event.recordedAt < since ||
      event.receivedAt < device.createdAt
    ) {
      continue;
    }
    for (const diagnostic of event.diagnostics) {
      if (
        diagnostic.kind !== 'CAN_ERROR' &&
        (diagnostic.kind !== 'DIAGNOSTIC_TROUBLE_CODE' ||
          diagnostic.spn === undefined ||
          diagnostic.fmi === undefined)
      ) {
        continue;
      }
      const troubleCode = diagnostic.kind === 'DIAGNOSTIC_TROUBLE_CODE' ? diagnostic.code : null;
      const status = diagnostic.kind === 'DIAGNOSTIC_TROUBLE_CODE' ? diagnostic.status : null;
      rows.push({
        tenantId: device.tenantId,
        branchId: device.branchId,
        sourceKind: 'DIAGNOSTIC',
        sourceKey: JSON.stringify([
          device.imei,
          event.recordedAt.toISOString(),
          diagnostic.kind,
          troubleCode,
          status,
        ]),
        category: 'DEVICE',
        severity: status === 'DELETED' ? 'INFO' : 'WARNING',
        occurredAt: event.recordedAt,
        createdAt,
        wordingKey: 'notification.recordedDiagnostic',
        parameters: {
          eventKind: diagnostic.kind,
          troubleCode,
          diagnosticStatus: status,
          alarmCode: event.alarmCode ?? null,
        },
        deviceId: device.id,
        vehicleId:
          event.receivedAt >= (device.installedAt ?? device.createdAt) ? device.vehicleId : null,
        sourceEventId: event.id.toString(),
      });
    }
  }
  return rows;
}

function parameterText(row: Prisma.FleetNotificationCreateManyInput, key: string): string | null {
  const parameters = row.parameters;
  if (typeof parameters !== 'object' || Array.isArray(parameters)) {
    return null;
  }
  const value: unknown = Object.entries(parameters).find(([name]) => name === key)?.[1];
  return typeof value === 'string' ? value : null;
}

/**
 * The rows without an "added" recorded-fault notification for a code whose previous logger
 * report on the vehicle also added it. Repeated snapshots report each active code as added. A new code and a code that returns after a removal still notify.
 * The previous report is the newest earlier one in Fleet's events or in the same rows.
 */
export async function withoutRepeatedFaults(
  client: Pick<Prisma.TransactionClient, 'fleetEvent'>,
  rows: readonly Prisma.FleetNotificationCreateManyInput[],
): Promise<Prisma.FleetNotificationCreateManyInput[]> {
  const reports = rows.flatMap((row) => {
    const troubleCode = parameterText(row, 'troubleCode');
    const status = parameterText(row, 'diagnosticStatus');
    return row.wordingKey === 'notification.recordedDiagnostic' &&
      parameterText(row, 'eventKind') === 'DIAGNOSTIC_TROUBLE_CODE' &&
      (status === 'ADDED' || status === 'DELETED') &&
      troubleCode !== null &&
      row.vehicleId
      ? [
          {
            row,
            scope: { tenantId: row.tenantId, branchId: row.branchId, vehicleId: row.vehicleId },
            troubleCode,
            at: new Date(row.occurredAt),
            added: status === 'ADDED',
          },
        ]
      : [];
  });
  const repeated = new Set<Prisma.FleetNotificationCreateManyInput>();
  for (const report of reports.filter((candidate) => candidate.added)) {
    const stored = await client.fleetEvent.findFirst({
      where: {
        ...report.scope,
        kind: 'DIAGNOSTIC_TROUBLE_CODE',
        troubleCode: report.troubleCode,
        occurredAt: { lt: report.at },
        OR: [{ diagnosticStatus: { in: [1, 2] } }, { details: { startsWith: legacyFaultPrefix } }],
      },
      orderBy: [{ occurredAt: 'desc' }, { diagnosticIndex: 'desc' }, { id: 'desc' }],
      select: { occurredAt: true, diagnosticStatus: true, details: true },
    });
    const previous = [
      ...(stored
        ? [
            {
              at: stored.occurredAt,
              added: storedDiagnosticStatus(stored) === 'ADDED',
            },
          ]
        : []),
      ...reports.filter(
        (other) =>
          other.scope.tenantId === report.scope.tenantId &&
          other.scope.branchId === report.scope.branchId &&
          other.scope.vehicleId === report.scope.vehicleId &&
          other.troubleCode === report.troubleCode &&
          other.at.getTime() < report.at.getTime(),
      ),
    ].sort((left, right) => right.at.getTime() - left.at.getTime())[0];
    if (previous?.added) {
      repeated.add(report.row);
    }
  }
  return rows.filter((row) => !repeated.has(row));
}
