import type {
  AdminVehicleProfileFragment,
  AdminVehicleProfileQuery,
  AdminVehicleEdataMeasurementsQuery,
  AdminVehicleDetailsFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import type { SeriesPoint } from '../../../ui/charts/column-series';
import { fleetFieldErrors } from '../field-errors';
import type { OdometerField, PreviousOdometerReading } from './odometer-drawer';
import { vehicleRow } from './vehicle-mapping';
import type { EdataObservation, VehicleProfile } from './vehicle-profile-view';

export function vehicleProfile(vehicle: AdminVehicleProfileFragment): VehicleProfile {
  return {
    ...vehicleRow(vehicle),
    currentDriverId: vehicle.currentDriverId,
    vin: vehicle.vin ?? '',
    fuelType: vehicle.fuelType,
    tankL: vehicle.fuelTankCapacityL,
    speedKph: vehicle.state.speedKph,
    latitude: vehicle.state.latitude,
    longitude: vehicle.state.longitude,
    headingDeg: vehicle.state.headingDeg,
    liveDevices: vehicle.devices,
    createdAt: vehicle.createdAt,
  };
}

export function vehicleDistance(
  distance: AdminVehicleProfileQuery['fleetDailyDistance'],
  dateOnly: (value: string) => string,
): readonly SeriesPoint[] {
  return distance.points.map((point) => ({
    key: point.date,
    label: dateOnly(point.date),
    value: point.distanceKm,
    valueText: String(point.distanceKm),
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

export function odometerFieldErrors(
  error: unknown,
  language: Language = 'en',
): Partial<Record<OdometerField, string>> {
  return fleetFieldErrors(error, ['odometerKm', 'recordedAt'], language);
}

/** Counts of raw observations; catalog scaling and physical units remain unverified. */
export function vehicleEdataObservations(
  series: AdminVehicleEdataMeasurementsQuery['fleetVehicleEdataMeasurements'] | null,
): readonly EdataObservation[] {
  return [1, 3, 539].flatMap((id) => {
    const items = series?.items.filter((item) => item.parameterId === id) ?? [];
    const latest = items.at(-1);
    return latest
      ? [
          {
            id,
            label: latest.name ?? `ID ${String(id)}`,
            count: items.length,
            lastAt: latest.recordedAt,
          },
        ]
      : [];
  });
}
