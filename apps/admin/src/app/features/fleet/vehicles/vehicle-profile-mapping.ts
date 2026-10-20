import type {
  AdminVehicleProfileFragment,
  AdminVehicleProfileQuery,
  AdminVehicleDetailsFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import type { SeriesPoint } from '../../../ui/charts/column-series';
import { formatNumber } from '../../../ui/format/format';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { OdometerField, PreviousOdometerReading } from './odometer-drawer';
import { vehicleRow } from './vehicle-mapping';
import type { VehicleProfile } from './vehicle-profile-view';

export function vehicleProfile(vehicle: AdminVehicleProfileFragment): VehicleProfile {
  return {
    ...vehicleRow(vehicle),
    vin: vehicle.vin ?? '',
    fuelType: vehicle.fuelType,
    tankL: vehicle.fuelTankCapacityL,
    speedKph: vehicle.state.speedKph,
    createdAt: vehicle.createdAt,
  };
}

export function vehicleDistance(
  distance: AdminVehicleProfileQuery['fleetDailyDistance'],
  language: Language,
): readonly SeriesPoint[] {
  const label = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return distance.points.map((point) => ({
    key: point.date,
    label: label.format(new Date(`${point.date}T12:00:00Z`)),
    value: point.distanceKm,
    valueText: `${formatNumber(point.distanceKm, language)} km`,
  }));
}

export function previousOdometer(
  vehicle: AdminVehicleDetailsFragment,
): PreviousOdometerReading | null {
  const state = vehicle.state;
  return state.odometerKm !== null &&
    state.odometerRecordedAt !== null &&
    state.odometerSource !== null
    ? {
        odometerKm: state.odometerKm,
        recordedAt: state.odometerRecordedAt,
        source: state.odometerSource,
      }
    : null;
}

export function odometerLatestAllowed(asOf: string | null, now: number): string {
  return new Date(asOf === null ? now : Math.min(now, Date.parse(asOf))).toISOString();
}

export function odometerFieldErrors(error: unknown): Partial<Record<OdometerField, string>> {
  return fieldErrors(error, ['odometerKm', 'recordedAt']);
}
