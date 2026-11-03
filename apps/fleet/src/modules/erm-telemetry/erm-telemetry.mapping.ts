import type { Device, Prisma } from '../../generated/prisma/client.js';
import type { ErmTelemetryEvent } from '../../integrations/erm/erm-telemetry.client.js';

export type ErmTelemetryDevice = Pick<
  Device,
  'id' | 'tenantId' | 'branchId' | 'imei' | 'vehicleId' | 'installedAt' | 'createdAt'
>;

function inRange(value: number | null, minimum: number, maximum: number): number | null {
  return value !== null && value >= minimum && value <= maximum ? value : null;
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
    if (
      event.eventTime === null ||
      event.eventTime.getTime() > event.receivedAt.getTime() + 60_000 ||
      event.receivedAt < since ||
      times.has(event.eventTime.getTime())
    ) {
      continue;
    }
    times.add(event.eventTime.getTime());
    const latitude = inRange(event.latitude, -90, 90);
    const longitude = inRange(event.longitude, -180, 180);
    const heading = inRange(event.heading, 0, 360);
    samples.push({
      tenantId: device.tenantId,
      branchId: device.branchId,
      vehicleId: device.vehicleId,
      deviceImei: device.imei,
      source: 'ERM',
      recordedAt: event.eventTime,
      receivedAt: event.receivedAt,
      latitude: longitude === null ? null : latitude,
      longitude: latitude === null ? null : longitude,
      speedKph: inRange(event.speedKmh, 0, 400),
      headingDeg: heading === null ? null : Math.round(heading) % 360,
      ignition: event.engineOn,
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
