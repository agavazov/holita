import { describe, expect, it } from '@jest/globals';
import {
  classifyActivity,
  classifyVehicleState,
  type DeviceSample,
  fuelStatus,
  NO_FACTS,
} from './vehicle-state.js';

const asOf = new Date('2026-10-18T06:30:00.000Z');
const HOUR = 3_600_000;

function sample(overrides: Partial<DeviceSample> = {}): DeviceSample {
  return {
    recordedAt: asOf,
    latitude: 42.7,
    longitude: 23.3,
    address: 'Sofia',
    speedKph: 0,
    headingDeg: 90,
    ignition: false,
    fuelLevelPct: 50,
    externalVoltage: 24.8,
    backupBatteryVoltage: 4.1,
    engineHours: 1200,
    coolantTempC: 80,
    ...overrides,
  };
}

describe('vehicle activity and fuel status', () => {
  it('classifies activity at the exact boundaries', () => {
    const at = (offsetMs: number, overrides: Partial<DeviceSample> = {}) =>
      classifyActivity(
        {
          hasDevice: true,
          latest: sample({ recordedAt: new Date(asOf.getTime() + offsetMs), ...overrides }),
        },
        asOf,
      );
    expect(classifyActivity({ hasDevice: false, latest: sample() }, asOf)).toBe('NO_DEVICE');
    expect(classifyActivity({ hasDevice: true, latest: null }, asOf)).toBe('NOT_CONNECTED');
    expect(classifyActivity({ hasDevice: true, latest: sample() }, null)).toBe('NOT_CONNECTED');
    // Exactly 48 h old still reports; one millisecond more is not connected.
    expect(at(-48 * HOUR)).toBe('PARKED');
    expect(at(-48 * HOUR - 1)).toBe('NOT_CONNECTED');
    expect(at(0, { ignition: null, speedKph: 30 })).toBe('ASSET');
    expect(at(0, { ignition: true, speedKph: 5 })).toBe('MOVING');
    expect(at(0, { ignition: true, speedKph: 4.99 })).toBe('IDLE');
    expect(at(0, { ignition: true, speedKph: null })).toBe('IDLE');
    expect(at(0, { ignition: false, speedKph: 50 })).toBe('PARKED');
  });

  it('derives the fuel status from fresh device readings only', () => {
    const at = (offsetMs: number, fuelLevelPct: number | null) =>
      fuelStatus(sample({ recordedAt: new Date(asOf.getTime() + offsetMs), fuelLevelPct }), asOf);
    expect(fuelStatus(null, asOf)).toBe('NO_DATA');
    expect(at(0, null)).toBe('NO_DATA');
    expect(at(-6 * HOUR, 11.9)).toBe('LOW');
    expect(at(-6 * HOUR - 1, 11.9)).toBe('STALE');
    expect(at(0, 12)).toBe('NORMAL');
    expect(at(0, 0)).toBe('LOW');
    expect(fuelStatus(sample(), null)).toBe('STALE');
  });

  it('builds the full state with the odometer of any source', () => {
    const odometer = {
      odometerKm: 120_000.5,
      recordedAt: new Date(asOf.getTime() + HOUR),
      source: 'MANUAL' as const,
    };
    expect(
      classifyVehicleState(
        {
          hasDevice: true,
          latest: sample({ ignition: true, speedKph: 80, fuelLevelPct: 9 }),
          odometer,
        },
        asOf,
      ),
    ).toEqual({
      activity: 'MOVING',
      lastReportedAt: asOf,
      latitude: 42.7,
      longitude: 23.3,
      address: 'Sofia',
      speedKph: 80,
      headingDeg: 90,
      ignition: true,
      fuelLevelPct: 9,
      fuelStatus: 'LOW',
      externalVoltage: 24.8,
      backupBatteryVoltage: 4.1,
      engineHours: 1200,
      coolantTempC: 80,
      odometerKm: 120_000.5,
      odometerRecordedAt: odometer.recordedAt,
      odometerSource: 'MANUAL',
    });
    expect(classifyVehicleState(NO_FACTS, null)).toMatchObject({
      activity: 'NO_DEVICE',
      fuelStatus: 'NO_DATA',
      lastReportedAt: null,
      odometerKm: null,
      odometerSource: null,
    });
  });
});
