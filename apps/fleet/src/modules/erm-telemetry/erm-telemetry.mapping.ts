import type { Device, Prisma } from '../../generated/prisma/client.js';
import type { ErmTelemetryEvent } from '../../integrations/erm/erm-telemetry.client.js';

export type ErmTelemetryDevice = Pick<
  Device,
  'id' | 'tenantId' | 'branchId' | 'imei' | 'vehicleId' | 'installedAt' | 'createdAt'
>;

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
      occurredAt: event.eventTime,
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
      for (const fault of edata.faults) {
        fleetEvents.push({
          ...common,
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: fault.status === 'ADDED' ? 'WARNING' : 'INFO',
          troubleCode: `SPN ${String(fault.spn)} FMI ${String(fault.fmi)}`,
          details:
            fault.status === 'ADDED'
              ? 'eData 419: the fault logger added this fault.'
              : 'eData 419: the fault logger deleted this fault; this does not prove a repair.',
        });
      }
    } else if (edata.canError) {
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
