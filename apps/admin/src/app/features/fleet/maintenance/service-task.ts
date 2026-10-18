import type { StatusTone } from '../../../theme/status-tones';

export const serviceUrgencies = ['OVERDUE', 'DUE_SOON', 'OK', 'DONE'] as const;
export type ServiceUrgency = (typeof serviceUrgencies)[number];

/** One service task, as the Maintenance list and the vehicle profile show it. */
export interface ServiceTaskRow {
  readonly id: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly kind: string;
  /** Calendar date (`YYYY-MM-DD`) the task is due by, if planned by date. */
  readonly dueOn: string | null;
  /** Odometer reading the task is due at, if planned by distance. */
  readonly dueKm: number | null;
  /** Distance to `dueKm` from the current odometer (negative when passed). */
  readonly kmLeft: number | null;
  readonly urgency: ServiceUrgency;
  readonly costCents: number | null;
  readonly notes: string;
}

export const urgencyTones: Record<ServiceUrgency, StatusTone> = {
  OVERDUE: 'danger',
  DUE_SOON: 'warn',
  OK: 'info',
  DONE: 'success',
};
