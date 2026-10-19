import type { AlertRow } from '../../app/features/fleet/alerts/alerts-view';
import type { ServiceTaskRow } from '../../app/features/fleet/maintenance/service-task';
import type { TripRow } from '../../app/features/fleet/trips/trips-view';
import type { VehicleForm } from '../../app/features/fleet/vehicles/vehicle-drawer';
import type { VehicleProfile } from '../../app/features/fleet/vehicles/vehicle-profile-view';
import type {
  VehicleRow,
  VehicleFuelStatus,
} from '../../app/features/fleet/vehicles/vehicles-view';
import {
  driverById,
  groupById,
  type SampleAlert,
  type SampleServiceTask,
  type SampleTrip,
  type SampleVehicle,
  vehicleById,
  sampleNow,
  sampleAlerts,
} from './fleet-samples';

// Story-only mapping from sample records to the rows the example views take (what the list
// queries of a real backend would return).

/** Sample counterpart of the server's fuel freshness classification. */
export function sampleFuelStatus(vehicle: SampleVehicle): VehicleFuelStatus {
  if (vehicle.fuelPct === null || vehicle.lastReportedAt === null) {
    return 'NO_DATA';
  }
  if (Date.parse(vehicle.lastReportedAt) < sampleNow - 6 * 3_600_000) {
    return 'STALE';
  }
  return vehicle.fuelPct < 12 ? 'LOW' : 'NORMAL';
}

export function vehicleRow(vehicle: SampleVehicle): VehicleRow {
  const group = groupById(vehicle.groupId);
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    fleetNumber: vehicle.fleetNumber || null,
    type: vehicle.type,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    status: vehicle.status,
    activity: vehicle.activity,
    lastReportedAt: vehicle.lastReportedAt,
    location: vehicle.location,
    driverName: driverById(vehicle.driverId)?.name ?? null,
    group: group ? { name: group.name, slot: group.slot } : null,
    odometerKm: vehicle.odometerKm,
    fuelPct: vehicle.fuelPct,
    fuelStatus: sampleFuelStatus(vehicle),
    openAlerts: sampleAlerts.filter(
      (alert) => alert.vehicleId === vehicle.id && alert.status === 'OPEN',
    ).length,
    notes: vehicle.notes,
  };
}

export function vehicleForm(vehicle: SampleVehicle): VehicleForm {
  return {
    plate: vehicle.plate,
    fleetNumber: vehicle.fleetNumber,
    vin: vehicle.vin,
    type: vehicle.type,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    tankL: vehicle.tankL,
    status: vehicle.status,
    groupId: vehicle.groupId,
    driverId: vehicle.driverId,
    notes: vehicle.notes,
  };
}

export function vehicleProfile(vehicle: SampleVehicle): VehicleProfile {
  return {
    ...vehicleRow(vehicle),
    vin: vehicle.vin,
    fuelType: vehicle.fuelType,
    tankL: vehicle.tankL,
    speedKph: vehicle.speedKph,
    createdAt: vehicle.createdAt,
  };
}

export function tripRow(trip: SampleTrip): TripRow {
  return {
    ...trip,
    plate: vehicleById(trip.vehicleId)?.plate ?? '—',
    driverName: driverById(trip.driverId)?.name ?? null,
    events: trip.events.map((event) => ({
      at: event.at,
      kind: event.kind,
      detail: event.detail,
      tone: event.severity,
    })),
  };
}

export function alertRow(alert: SampleAlert): AlertRow {
  return {
    ...alert,
    plate: vehicleById(alert.vehicleId)?.plate ?? '—',
    driverName: driverById(alert.driverId)?.name ?? null,
  };
}

export function serviceTaskRow(task: SampleServiceTask): ServiceTaskRow {
  const vehicle = vehicleById(task.vehicleId);
  return {
    id: task.id,
    vehicleId: task.vehicleId,
    plate: vehicle?.plate ?? '—',
    kind: task.kind,
    serviceType: task.serviceType,
    status: task.status,
    dueOn: task.dueOn,
    dueKm: task.dueKm,
    kmLeft:
      task.status !== 'PLANNED' || task.dueKm === null || !vehicle
        ? null
        : Math.sign(task.dueKm - vehicle.odometerKm) *
          Math.round(Math.abs(task.dueKm - vehicle.odometerKm)),
    urgency: task.urgency,
    costCents: task.costEur === null ? null : task.costEur * 100,
    notes: task.notes,
  };
}
