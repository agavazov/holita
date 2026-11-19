import type { Device, Prisma } from '../../generated/prisma/client.js';
import type { DeviceReport } from '@discocan/device-contract';
import { WARNING_LAMP_PARAMETER_IDS } from '../devices/warning-lamps.js';

export type TelemetryDevice = Pick<
  Device,
  'id' | 'type' | 'tenantId' | 'branchId' | 'imei' | 'vehicleId' | 'installedAt' | 'createdAt'
>;

/** The Simple eData vendor catalog whose Monitor names, units and scaling label measurements. */
export const MEASUREMENT_CATALOG = {
  sourceSha256: '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0',
  extractorVersion: '1.0.0',
  schemaVersion: 1,
} as const;

export function deviceMeasurements(
  device: TelemetryDevice,
  reports: DeviceReport[],
  labels: ReadonlyMap<number, { name: string | null; unit: string | null }>,
): Prisma.VehicleEdataMeasurementCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const measurements: Prisma.VehicleEdataMeasurementCreateManyInput[] = [];
  for (const event of reports) {
    if (!importableReport(event, since)) {
      continue;
    }
    for (const measurement of event.measurements) {
      // Ignition-on telltales can be red before the engine builds brake air pressure.
      if (
        !measurement.freezeFrame &&
        event.engineOn === false &&
        WARNING_LAMP_PARAMETER_IDS.some((id) => id === measurement.parameterId)
      ) {
        continue;
      }
      measurements.push({
        tenantId: device.tenantId,
        branchId: device.branchId,
        vehicleId: device.vehicleId,
        deviceImei: device.imei,
        source: device.type,
        sourceEventId: event.id,
        recordedAt: event.recordedAt,
        receivedAt: event.receivedAt,
        ...measurement,
        name: labels.get(measurement.parameterId)?.name ?? null,
        unit: labels.get(measurement.parameterId)?.unit ?? null,
      });
    }
  }
  return measurements;
}

function inRange(value: number | null, minimum: number, maximum: number): number | null {
  return value !== null && value >= minimum && value <= maximum ? value : null;
}

function importableReport(
  event: DeviceReport,
  since: Date,
): event is DeviceReport & { recordedAt: Date } {
  return (
    event.recordedAt !== null &&
    event.recordedAt.getTime() <= event.receivedAt.getTime() + 60_000 &&
    event.receivedAt >= since
  );
}

function position(event: DeviceReport) {
  const latitude = inRange(event.latitude, -90, 90);
  const longitude = inRange(event.longitude, -180, 180);
  return {
    latitude: longitude === null ? null : latitude,
    longitude: latitude === null ? null : longitude,
    speedKph: inRange(event.speedKph, 0, 400),
  };
}

export function deviceSamples(
  device: TelemetryDevice,
  reports: DeviceReport[],
): Prisma.VehicleStatusSampleCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const times = new Set<number>();
  const samples: Prisma.VehicleStatusSampleCreateManyInput[] = [];
  for (const event of reports) {
    if (!importableReport(event, since) || times.has(event.recordedAt.getTime())) {
      continue;
    }
    times.add(event.recordedAt.getTime());
    const heading = inRange(event.headingDeg, 0, 360);
    samples.push({
      tenantId: device.tenantId,
      branchId: device.branchId,
      vehicleId: device.vehicleId,
      deviceImei: device.imei,
      source: device.type,
      recordedAt: event.recordedAt,
      receivedAt: event.receivedAt,
      ...position(event),
      headingDeg: heading === null ? null : Math.round(heading) % 360,
      ignition: event.ignition ?? event.engineOn,
      odometerKm: inRange(event.odometerKm, 0, 10_000_000),
      externalVoltage: inRange(event.externalVoltage, 0, 60),
      backupBatteryVoltage: inRange(event.backupBatteryVoltage, 0, 10),
      address: null,
      fuelLevelPct: null,
      engineHours: null,
      coolantTempC: null,
    });
  }
  return samples;
}

export function deviceEvents(
  device: TelemetryDevice,
  reports: DeviceReport[],
): Prisma.FleetEventCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const fleetEvents: Prisma.FleetEventCreateManyInput[] = [];
  for (const event of reports) {
    if (!importableReport(event, since)) {
      continue;
    }
    const common = {
      tenantId: device.tenantId,
      branchId: device.branchId,
      vehicleId: device.vehicleId,
      deviceImei: device.imei,
      source: device.type,
      sourceEventId: event.id,
      occurredAt: event.recordedAt,
      receivedAt: event.receivedAt,
      ...position(event),
      tripId: null,
      driverId: null,
      intensity: null,
      address: null,
      measuredValue: null,
      thresholdValue: null,
      alertStatus: null,
      acknowledgedAt: null,
      resolvedAt: null,
      remark: null,
    };
    for (const diagnostic of event.diagnostics) {
      const coded = diagnostic.kind === 'DIAGNOSTIC_TROUBLE_CODE';
      const removed = coded && diagnostic.status === 'DELETED';
      fleetEvents.push({
        ...common,
        kind: diagnostic.kind,
        diagnosticReport: diagnostic.report,
        diagnosticIndex: diagnostic.index,
        ...(coded
          ? {
              ...(diagnostic.spn === undefined ? {} : { diagnosticSpn: BigInt(diagnostic.spn) }),
              ...(diagnostic.fmi === undefined ? {} : { diagnosticFmi: diagnostic.fmi }),
              diagnosticStatus: removed ? 2 : 1,
            }
          : {}),
        severity: removed ? 'INFO' : 'WARNING',
        troubleCode: coded ? diagnostic.code : null,
        details: diagnostic.details ?? null,
      });
    }
  }
  return fleetEvents;
}
