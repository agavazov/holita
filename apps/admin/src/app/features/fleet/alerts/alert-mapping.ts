import type {
  AdminAlertDetailsFragment,
  FleetEventKind,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { AlertRow } from './alerts-view';
import { alertsText } from './i18n/messages';

export function alertRow(event: AdminAlertDetailsFragment, language: Language): AlertRow | null {
  if (event.alertStatus === null) {
    return null;
  }
  const kinds: Record<FleetEventKind, string> = alertsText(language).kinds;
  return {
    id: event.id,
    vehicleId: event.vehicleId,
    plate: event.vehicle.licensePlate,
    driverName: event.driver ? `${event.driver.firstName} ${event.driver.lastName}` : null,
    kind: kinds[event.kind],
    detail: event.details ?? '',
    severity: event.severity,
    status: event.alertStatus,
    occurredAt: event.occurredAt,
    remark: event.remark ?? '',
  };
}

export function alertRemarkError(error: unknown): string | null {
  return fieldErrors(error, ['remark']).remark ?? null;
}
