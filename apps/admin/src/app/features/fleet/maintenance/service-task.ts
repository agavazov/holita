import type { StatusTone } from '../../../theme/status-tones';

export const serviceTypes = [
  'GENERAL_SERVICE',
  'OIL_CHANGE',
  'ANNUAL_INSPECTION',
  'TACHOGRAPH_CALIBRATION',
  'BRAKES',
  'TIRES',
  'REPAIR',
  'OTHER',
] as const;
export type ServiceType = (typeof serviceTypes)[number];
export type ServiceStatus = 'PLANNED' | 'DONE' | 'CANCELLED';
export const serviceUrgencies = ['OVERDUE', 'DUE_SOON', 'UNKNOWN_ODOMETER', 'UPCOMING'] as const;
export type ServiceUrgency = (typeof serviceUrgencies)[number];

/** One service task, as the Maintenance list and the vehicle profile show it. */
export interface ServiceTaskRow {
  readonly id: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly kind: string;
  readonly serviceType: ServiceType;
  readonly status: ServiceStatus;
  /** Calendar date (`YYYY-MM-DD`) the task is due by, if planned by date. */
  readonly dueOn: string | null;
  /** Odometer reading the task is due at, if planned by distance. */
  readonly dueKm: number | null;
  /** Distance to `dueKm` from the current odometer (negative when passed). */
  readonly kmLeft: number | null;
  readonly urgency: ServiceUrgency | null;
  readonly costCents: number | null;
  readonly notes: string;
}

export const urgencyTones: Record<ServiceUrgency, StatusTone> = {
  OVERDUE: 'danger',
  DUE_SOON: 'warn',
  UNKNOWN_ODOMETER: 'warn',
  UPCOMING: 'info',
};

export const serviceStatusTones: Record<ServiceStatus, StatusTone> = {
  PLANNED: 'info',
  DONE: 'success',
  CANCELLED: 'neutral',
};
