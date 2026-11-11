import type { Device, Prisma } from '../../generated/prisma/client.js';
import type { ErmTelemetryEvent } from '../../integrations/erm/erm-telemetry.client.js';
import { WARNING_LAMP_PARAMETER_IDS } from '../devices/warning-lamps.js';

export type ErmTelemetryDevice = Pick<
  Device,
  'id' | 'tenantId' | 'branchId' | 'imei' | 'vehicleId' | 'installedAt' | 'createdAt'
>;

/** The Simple eData vendor catalog whose Monitor names, units and scaling label measurements. */
export const MEASUREMENT_CATALOG = {
  sourceSha256: '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0',
  extractorVersion: '1.0.0',
  schemaVersion: 1,
} as const;

export function ermEdataMeasurementsEnabled(): boolean {
  const value = process.env.FLEET_ERM_EDATA_MEASUREMENTS_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_ERM_EDATA_MEASUREMENTS_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

export function ermEdataMeasurements(
  device: ErmTelemetryDevice,
  events: ErmTelemetryEvent[],
  labels: ReadonlyMap<number, { name: string | null; unit: string | null }>,
): Prisma.VehicleEdataMeasurementCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const measurements: Prisma.VehicleEdataMeasurementCreateManyInput[] = [];
  for (const event of events) {
    if (
      !importableEvent(event, since) ||
      (event.edata?.report !== '405' && event.edata?.report !== '415')
    ) {
      continue;
    }
    // A 415 freeze frame keeps every captured value; latest-value views read 405 rows only.
    const freezeFrame = event.edata.report === '415';
    for (const measurement of event.edata.measurements) {
      // Ignition-on telltales can be red before the engine builds brake air pressure.
      if (
        !freezeFrame &&
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
        source: 'ERM',
        sourceEventId: event.id,
        recordedAt: event.eventTime,
        receivedAt: event.receivedAt,
        ...measurement,
        name: labels.get(measurement.parameterId)?.name ?? null,
        unit: labels.get(measurement.parameterId)?.unit ?? null,
        freezeFrame,
      });
    }
  }
  return measurements;
}

function inRange(value: number | null, minimum: number, maximum: number): number | null {
  return value !== null && value >= minimum && value <= maximum ? value : null;
}

function importableEvent(
  event: ErmTelemetryEvent,
  since: Date,
): event is ErmTelemetryEvent & { eventTime: Date } {
  return (
    event.eventTime !== null &&
    event.eventTime.getTime() <= event.receivedAt.getTime() + 60_000 &&
    event.receivedAt >= since
  );
}

function position(event: ErmTelemetryEvent) {
  const latitude = inRange(event.latitude, -90, 90);
  const longitude = inRange(event.longitude, -180, 180);
  return {
    latitude: longitude === null ? null : latitude,
    longitude: latitude === null ? null : longitude,
    speedKph: inRange(event.speedKmh, 0, 400),
  };
}

export function ermSamples(
  device: ErmTelemetryDevice,
  events: ErmTelemetryEvent[],
): Prisma.VehicleStatusSampleCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const times = new Set<number>();
  const samples: Prisma.VehicleStatusSampleCreateManyInput[] = [];
  for (const event of events) {
    if (!importableEvent(event, since) || times.has(event.eventTime.getTime())) {
      continue;
    }
    times.add(event.eventTime.getTime());
    const heading = inRange(event.heading, 0, 360);
    samples.push({
      tenantId: device.tenantId,
      branchId: device.branchId,
      vehicleId: device.vehicleId,
      deviceImei: device.imei,
      source: 'ERM',
      recordedAt: event.eventTime,
      receivedAt: event.receivedAt,
      ...position(event),
      headingDeg: heading === null ? null : Math.round(heading) % 360,
      ignition: event.ignitionOn ?? event.engineOn,
      odometerKm: inRange(event.odometerKm, 0, 10_000_000),
      externalVoltage: inRange(event.mainVoltage, 0, 60),
      backupBatteryVoltage: inRange(event.backupVoltage, 0, 10),
      address: null,
      fuelLevelPct: null,
      engineHours: null,
      coolantTempC: null,
    });
  }
  return samples;
}

export function ermFleetEvents(
  device: ErmTelemetryDevice,
  events: ErmTelemetryEvent[],
): Prisma.FleetEventCreateManyInput[] {
  if (device.vehicleId === null) {
    return [];
  }
  const since = device.installedAt ?? device.createdAt;
  const fleetEvents: Prisma.FleetEventCreateManyInput[] = [];
  for (const event of events) {
    if (!importableEvent(event, since) || event.edata === null) {
      continue;
    }
    const common = {
      tenantId: device.tenantId,
      branchId: device.branchId,
      vehicleId: device.vehicleId,
      deviceImei: device.imei,
      source: 'ERM' as const,
      sourceEventId: event.id,
      occurredAt: event.eventTime,
      receivedAt: event.receivedAt,
      diagnosticReport: Number(event.edata.report),
      diagnosticIndex: 0,
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
    const edata = event.edata;
    if (edata.report === '419') {
      for (const [diagnosticIndex, fault] of edata.faults.entries()) {
        fleetEvents.push({
          ...common,
          diagnosticIndex,
          diagnosticSpn: BigInt(fault.spn),
          diagnosticFmi: fault.fmi,
          diagnosticStatus: fault.status === 'ADDED' ? 1 : 2,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: fault.status === 'ADDED' ? 'WARNING' : 'INFO',
          troubleCode: `SPN ${String(fault.spn)} FMI ${String(fault.fmi)}`,
          details:
            fault.status === 'ADDED'
              ? 'eData 419: the fault logger added this fault.'
              : 'eData 419: the fault logger deleted this fault; this does not prove a repair.',
        });
      }
    } else if (edata.report === '413' || edata.report === '418') {
      for (const [diagnosticIndex, fault] of edata.faults.entries()) {
        fleetEvents.push({
          ...common,
          diagnosticIndex,
          diagnosticStatus: fault.status === 'ADDED' ? 1 : 2,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: fault.status === 'ADDED' ? 'WARNING' : 'INFO',
          troubleCode: fault.code,
          details:
            fault.status === 'ADDED'
              ? `eData ${edata.report}: the fault logger added this fault.`
              : `eData ${edata.report}: the fault logger deleted this fault; this does not prove a repair.`,
        });
      }
    } else if (edata.report === '417') {
      fleetEvents.push({
        ...common,
        kind: 'CAN_DISCONNECTED',
        severity: 'WARNING',
        troubleCode: null,
        details: 'eData 417 reported no CAN messages for 500 ms while ignition was on.',
      });
    } else if (edata.report === '411' && edata.canError) {
      fleetEvents.push({
        ...common,
        kind: 'CAN_ERROR',
        severity: 'WARNING',
        troubleCode: null,
        details: `eData 411 reported the CAN error flag; CAN=${String(Number(edata.can))}, J1708=${String(Number(edata.j1708))}, OBD=${String(Number(edata.obd))}, OBD mask=${String(edata.obdMask)}, ignition=${String(edata.ignition)}.`,
      });
    }
  }
  return fleetEvents;
}
