import type { FleetWarningLamp, FleetWarningLampState } from '../../generated/graphql/types.js';

export const WARNING_LAMP_PARAMETER_IDS = [1896, 1906, 1910] as const;

const TELLTALE_STATES: readonly FleetWarningLampState[] = [
  'OFF',
  'RED',
  'YELLOW',
  'INFORMATION',
  'RESERVED',
  'RESERVED',
  'RESERVED',
  'NOT_AVAILABLE',
];

export function warningLamp(
  deviceId: string,
  parameterId: number,
  measurement?: { valueSize: number; valueHex: string; recordedAt: Date; stateSince?: Date },
): FleetWarningLamp {
  const value =
    measurement?.valueSize === 1 && /^[0-9a-f]{2}$/i.test(measurement.valueHex)
      ? Number.parseInt(measurement.valueHex, 16)
      : null;
  return {
    deviceId,
    parameterId,
    state: value === null ? 'UNKNOWN' : (TELLTALE_STATES[value] ?? 'UNKNOWN'),
    value,
    valueHex: measurement?.valueHex ?? null,
    recordedAt: measurement?.recordedAt ?? null,
    stateSince: measurement?.stateSince ?? measurement?.recordedAt ?? null,
  };
}

export function currentWarnings(lamps: readonly FleetWarningLamp[]): FleetWarningLamp[] {
  return lamps.filter(
    (lamp) => lamp.state === 'RED' || lamp.state === 'YELLOW' || lamp.state === 'INFORMATION',
  );
}
