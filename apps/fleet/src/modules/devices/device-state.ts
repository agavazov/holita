import { NOT_CONNECTED_AFTER_HOURS } from '../../fleet-thresholds.js';
import type { FleetDeviceStatus } from '../../generated/graphql/types.js';

export const DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'IN_STOCK'] as const;

/** Only the current (Vehicle, IMEI) report contributes; stock never inherits old reports. */
export function deviceStatus(
  vehicleId: string | null,
  lastReportedAt: Date | null,
  asOf: Date | null,
  notReportingHours = NOT_CONNECTED_AFTER_HOURS,
): FleetDeviceStatus {
  if (vehicleId === null) {
    return 'IN_STOCK';
  }
  return lastReportedAt !== null &&
    asOf !== null &&
    lastReportedAt.getTime() >= asOf.getTime() - notReportingHours * 3_600_000
    ? 'ONLINE'
    : 'OFFLINE';
}
