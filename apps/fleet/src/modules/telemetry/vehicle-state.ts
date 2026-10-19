import {
  FUEL_READING_MAX_AGE_HOURS,
  LOW_FUEL_PERCENT,
  MOVING_MIN_SPEED_KPH,
  NOT_CONNECTED_AFTER_HOURS,
} from '../../fleet-thresholds.js';
import type {
  FleetActivityStatus,
  FleetFuelStatus,
  FleetVehicleState,
} from '../../generated/graphql/types.js';
import type { FleetDataSource, FleetVehicleStatus } from '../../generated/prisma/enums.js';

const HOUR_MS = 3_600_000;

/** Latest sample reported by a device (`deviceImei` set); MANUAL readings never count here. */
export interface DeviceSample {
  readonly recordedAt: Date;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly address: string | null;
  readonly speedKph: number | null;
  readonly headingDeg: number | null;
  readonly ignition: boolean | null;
  readonly fuelLevelPct: number | null;
  readonly externalVoltage: number | null;
  readonly backupBatteryVoltage: number | null;
  readonly engineHours: number | null;
  readonly coolantTempC: number | null;
}

/** Stored facts of one vehicle: status, devices, latest device sample, latest odometer. */
export interface VehicleFacts {
  readonly vehicleId: string;
  readonly status: FleetVehicleStatus;
  readonly hasDevice: boolean;
  readonly latest: DeviceSample | null;
  /** Latest non-null odometer of any source, including MANUAL readings. */
  readonly odometer: {
    readonly odometerKm: number;
    readonly recordedAt: Date;
    readonly source: FleetDataSource;
  } | null;
}

/** The single activity classifier (applies to every vehicle, INACTIVE included). */
export function classifyActivity(
  facts: Pick<VehicleFacts, 'hasDevice' | 'latest'>,
  asOf: Date | null,
): FleetActivityStatus {
  if (!facts.hasDevice) {
    return 'NO_DEVICE';
  }
  const sample = facts.latest;
  if (
    sample === null ||
    asOf === null ||
    sample.recordedAt.getTime() < asOf.getTime() - NOT_CONNECTED_AFTER_HOURS * HOUR_MS
  ) {
    return 'NOT_CONNECTED';
  }
  if (sample.ignition === null) {
    return 'ASSET';
  }
  if (!sample.ignition) {
    return 'PARKED';
  }
  return sample.speedKph !== null && sample.speedKph >= MOVING_MIN_SPEED_KPH ? 'MOVING' : 'IDLE';
}

/** The single fuel status definition (list tone, KPI and attention). */
export function fuelStatus(sample: DeviceSample | null, asOf: Date | null): FleetFuelStatus {
  if (sample === null || sample.fuelLevelPct === null) {
    return 'NO_DATA';
  }
  if (
    asOf === null ||
    sample.recordedAt.getTime() < asOf.getTime() - FUEL_READING_MAX_AGE_HOURS * HOUR_MS
  ) {
    return 'STALE';
  }
  return sample.fuelLevelPct < LOW_FUEL_PERCENT ? 'LOW' : 'NORMAL';
}

type StateFacts = Pick<VehicleFacts, 'hasDevice' | 'latest' | 'odometer'>;

/** Facts of a vehicle without devices, samples or readings (also a deleted vehicle). */
export const NO_FACTS: StateFacts = { hasDevice: false, latest: null, odometer: null };

export function classifyVehicleState(facts: StateFacts, asOf: Date | null): FleetVehicleState {
  const sample = facts.latest;
  return {
    activity: classifyActivity(facts, asOf),
    lastReportedAt: sample?.recordedAt ?? null,
    latitude: sample?.latitude ?? null,
    longitude: sample?.longitude ?? null,
    address: sample?.address ?? null,
    speedKph: sample?.speedKph ?? null,
    headingDeg: sample?.headingDeg ?? null,
    ignition: sample?.ignition ?? null,
    fuelLevelPct: sample?.fuelLevelPct ?? null,
    fuelStatus: fuelStatus(sample, asOf),
    externalVoltage: sample?.externalVoltage ?? null,
    backupBatteryVoltage: sample?.backupBatteryVoltage ?? null,
    engineHours: sample?.engineHours ?? null,
    coolantTempC: sample?.coolantTempC ?? null,
    odometerKm: facts.odometer?.odometerKm ?? null,
    odometerRecordedAt: facts.odometer?.recordedAt ?? null,
    odometerSource: facts.odometer?.source ?? null,
  };
}
