import type { VehicleField, VehicleForm } from '../../app/features/fleet/vehicles/vehicle-drawer';
import type { VehiclesText } from '../../app/features/fleet/vehicles/i18n/messages';
import type { SampleVehicle } from './fleet-samples';

/** Mirrors vehicle write constraints in the sample hosts without making backend calls. */
export function vehicleFormErrors(
  vehicles: readonly SampleVehicle[],
  excludeId: string | null,
  form: VehicleForm,
  text: VehiclesText['drawer'],
): Partial<Record<VehicleField, string>> {
  const errors: Partial<Record<VehicleField, string>> = {};
  for (const vehicle of vehicles) {
    if (vehicle.id === excludeId) {
      continue;
    }
    if (form.fleetNumber && form.fleetNumber === vehicle.fleetNumber) {
      errors.fleetNumber = text.duplicateFleetNumber;
    }
    if (form.vin && form.vin === vehicle.vin) {
      errors.vin = text.duplicateVin;
    }
  }
  if (form.status === 'INACTIVE' && form.driverId !== null) {
    errors.driverId = text.inactiveDriver;
  }
  return errors;
}
