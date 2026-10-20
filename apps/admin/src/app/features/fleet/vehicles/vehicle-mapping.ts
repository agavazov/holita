import type {
  AdminVehicleDetailsFragment,
  CreateFleetVehicleInput,
} from '../../../../generated/graphql/operations';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { VehicleField, VehicleForm } from './vehicle-drawer';
import type { VehicleRow } from './vehicles-view';

/** The view uses short field names; the generated contract remains the API model. */
export function vehicleRow(vehicle: AdminVehicleDetailsFragment): VehicleRow {
  return {
    id: vehicle.id,
    plate: vehicle.licensePlate,
    fleetNumber: vehicle.fleetNumber,
    type: vehicle.vehicleType,
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    year: vehicle.modelYear,
    status: vehicle.status,
    activity: vehicle.state.activity,
    lastReportedAt: vehicle.state.lastReportedAt,
    location: vehicle.state.address,
    driverName: vehicle.currentDriver
      ? `${vehicle.currentDriver.firstName} ${vehicle.currentDriver.lastName}`
      : null,
    group: vehicle.group
      ? { name: vehicle.group.name, slot: vehicle.group.colorToken.toLowerCase() }
      : null,
    odometerKm: vehicle.state.odometerKm,
    fuelPct: vehicle.state.fuelLevelPct,
    fuelStatus: vehicle.state.fuelStatus,
    openAlerts: vehicle.openAlertCount,
    notes: vehicle.notes ?? '',
  };
}

export function vehicleForm(vehicle: AdminVehicleDetailsFragment): VehicleForm {
  return {
    plate: vehicle.licensePlate,
    fleetNumber: vehicle.fleetNumber ?? '',
    vin: vehicle.vin ?? '',
    type: vehicle.vehicleType,
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    year: vehicle.modelYear,
    fuelType: vehicle.fuelType,
    tankL: vehicle.fuelTankCapacityL,
    status: vehicle.status,
    groupId: vehicle.groupId,
    driverId: vehicle.currentDriverId,
    notes: vehicle.notes ?? '',
  };
}

/** Full editor submissions explicitly clear empty optional fields for both create and update. */
export function vehicleInput(form: VehicleForm): CreateFleetVehicleInput {
  return {
    licensePlate: form.plate.trim(),
    fleetNumber: form.fleetNumber.trim() || null,
    vin: form.vin.trim().toUpperCase() || null,
    vehicleType: form.type,
    make: form.make.trim() || null,
    model: form.model.trim() || null,
    modelYear: form.year,
    fuelType: form.fuelType,
    fuelTankCapacityL: form.tankL,
    status: form.status,
    groupId: form.groupId,
    currentDriverId: form.driverId,
    notes: form.notes.trim() || null,
  };
}

const fieldPaths = {
  licensePlate: 'plate',
  fleetNumber: 'fleetNumber',
  vin: 'vin',
  vehicleType: 'type',
  make: 'make',
  model: 'model',
  modelYear: 'year',
  fuelType: 'fuelType',
  fuelTankCapacityL: 'tankL',
  status: 'status',
  groupId: 'groupId',
  currentDriverId: 'driverId',
  notes: 'notes',
} satisfies Record<keyof CreateFleetVehicleInput, VehicleField>;

export function vehicleFieldErrors(error: unknown): Partial<Record<VehicleField, string>> {
  const errors = fieldErrors(error, Object.keys(fieldPaths));
  const result: Partial<Record<VehicleField, string>> = {};
  for (const [path, field] of Object.entries(fieldPaths)) {
    const message = errors[path];
    if (message !== undefined) {
      result[field] = message;
    }
  }
  return result;
}
