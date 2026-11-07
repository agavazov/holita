import type { Prisma, VehicleEdataMeasurement } from '../../generated/prisma/client.js';
import { WARNING_LAMP_PARAMETER_IDS, warningLamp } from '../devices/warning-lamps.js';
import type { ErmTelemetryDevice } from '../erm-telemetry/erm-telemetry.mapping.js';

type LampMeasurement = Pick<
  VehicleEdataMeasurement,
  'id' | 'parameterId' | 'valueSize' | 'valueHex' | 'recordedAt' | 'receivedAt' | 'sourceEventId'
>;

const LAMPS = new Map<number, string>([
  [1896, 'BRAKE_SYSTEM'],
  [1906, 'ENGINE'],
  [1910, 'ABS'],
]);

function compare(left: LampMeasurement, right: LampMeasurement): number {
  return (
    left.recordedAt.getTime() - right.recordedAt.getTime() ||
    left.receivedAt.getTime() - right.receivedAt.getTime() ||
    (left.sourceEventId < right.sourceEventId
      ? -1
      : left.sourceEventId > right.sourceEventId
        ? 1
        : 0) ||
    left.id.localeCompare(right.id)
  );
}

/** Only newly inserted, forward observations can change the retained current state. */
export function warningLampNotifications(
  device: ErmTelemetryDevice,
  previous: readonly LampMeasurement[],
  inserted: readonly LampMeasurement[],
  since: Date,
  createdAt: Date,
): Prisma.FleetNotificationCreateManyInput[] {
  const latest = new Map(previous.map((row) => [row.parameterId, row]));
  const rows: Prisma.FleetNotificationCreateManyInput[] = [];
  for (const measurement of [...inserted].sort(compare)) {
    if (!WARNING_LAMP_PARAMETER_IDS.some((id) => id === measurement.parameterId)) {
      continue;
    }
    const before = latest.get(measurement.parameterId);
    if (before && compare(measurement, before) <= 0) {
      continue;
    }
    latest.set(measurement.parameterId, measurement);
    const previousState = warningLamp(device.id, measurement.parameterId, before).state;
    const state = warningLamp(device.id, measurement.parameterId, measurement).state;
    const entered = state === 'RED' || state === 'YELLOW';
    const returnedOff =
      state === 'OFF' &&
      (previousState === 'RED' || previousState === 'YELLOW' || previousState === 'INFORMATION');
    if (state === previousState || (!entered && !returnedOff) || measurement.recordedAt < since) {
      continue;
    }
    rows.push({
      tenantId: device.tenantId,
      branchId: device.branchId,
      sourceKind: 'DIAGNOSTIC',
      sourceKey: `warning-lamp:${device.id}:${measurement.sourceEventId.toString()}:${String(measurement.parameterId)}`,
      category: 'DEVICE',
      severity: state === 'RED' ? 'CRITICAL' : state === 'YELLOW' ? 'WARNING' : 'INFO',
      occurredAt: measurement.recordedAt,
      createdAt,
      wordingKey: entered ? 'notification.warningLampEntered' : 'notification.warningLampOff',
      parameters: {
        lamp: LAMPS.get(measurement.parameterId) ?? 'OTHER',
        state,
        previousState,
        deviceId: device.id,
        vehicleId: device.vehicleId,
      },
      deviceId: device.id,
      vehicleId: device.vehicleId,
      ermEventId: measurement.sourceEventId.toString(),
    });
  }
  return rows;
}
