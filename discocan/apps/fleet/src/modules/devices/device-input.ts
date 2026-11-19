import type { FleetClock } from '../../clock/fleet-clock.js';
import type {
  CreateFleetDeviceInput,
  FleetErmDeviceInput,
  UpdateFleetDeviceInput,
} from '../../generated/graphql/types.js';
import {
  FleetDeviceModel,
  FleetDeviceOption,
  FleetDeviceType,
} from '../../generated/prisma/enums.js';
import {
  enumList,
  invalid,
  optionalDateTime,
  optionalEnum,
  optionalPattern,
  optionalText,
  optionalUuid,
} from '../../validation.js';
import type { DeviceData } from './devices.repository.js';

export const DEVICE_MODELS = Object.values(FleetDeviceModel);
export const DEVICE_OPTIONS = Object.values(FleetDeviceOption);

/** Options each model supports; OTHER accepts every option and no model accepts none. */
const MODEL_OPTIONS: Record<FleetDeviceModel, readonly FleetDeviceOption[]> = {
  STARLINK_TRACKER: [
    'CELLULAR_4G',
    'SAFETY_SF',
    'IRF',
    'CAN',
    'DRIVER_ID',
    'ECONNECT',
    'RS232',
    'EXTERNAL_ANTENNA',
    'VOICE',
    'WIFI',
    'WILIOT',
  ],
  STARLINK_SCOUT: ['CELLULAR_4G', 'SAFETY_SF', 'TEMPERATURE_DS', 'GEOZONES_GO', 'IRF'],
  OTHER: DEVICE_OPTIONS,
};

function imei(value: unknown): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9]{15}$/.test(result)) {
    invalid('imei', 'Enter an IMEI of exactly 15 digits.', 'INVALID_FORMAT');
  }
  return result;
}

function options(value: unknown): DeviceData['options'] {
  return value === null || value === undefined
    ? []
    : enumList(value, DEVICE_OPTIONS, 'options', DEVICE_OPTIONS.length);
}

export function checkOptions(
  model: FleetDeviceModel | null,
  selected: readonly FleetDeviceOption[],
) {
  const supported = model === null ? [] : MODEL_OPTIONS[model];
  if (selected.some((option) => !supported.includes(option))) {
    invalid(
      'options',
      model === null
        ? 'Choose a device model before selecting options.'
        : 'Choose only options that the selected model supports.',
      model === null ? 'MODEL_REQUIRED' : 'MODEL_OPTIONS_UNSUPPORTED',
    );
  }
}

function serialNumber(value: unknown): string | null {
  return optionalPattern(
    value,
    'serialNumber',
    32,
    /^[0-9A-Za-z-]{1,32}$/,
    'Use 1 to 32 letters, digits and hyphens.',
  );
}

function firmwareVersion(value: unknown): string | null {
  return optionalPattern(
    value,
    'firmwareVersion',
    32,
    /^[0-9A-Za-z._-]{1,32}$/,
    'Use letters, digits, dots, underscores and hyphens.',
  );
}

export function edataModule(
  type: FleetDeviceType,
  erm: FleetErmDeviceInput | null | undefined,
): string | null | undefined {
  if (erm === undefined) {
    return undefined;
  }
  if (type !== 'ERM') {
    invalid('erm', 'ERM metadata is only available for ERM devices.', 'UNSUPPORTED_VALUE');
  }
  if (erm === null) {
    return null;
  }
  if (erm.edataModule === undefined) {
    return undefined;
  }
  return optionalPattern(
    erm.edataModule,
    'erm.edataModule',
    64,
    /^[ -~]{1,64}$/,
    'Use 1 to 64 printable characters.',
  );
}

function simPhoneNumber(value: unknown): string | null {
  return optionalPattern(
    value,
    'simPhoneNumber',
    20,
    /^\+?[0-9]{6,19}$/,
    'Enter 6 to 19 digits with an optional leading +.',
  );
}

function simIccid(value: unknown): string | null {
  return optionalPattern(value, 'simIccid', 22, /^[0-9]{18,22}$/, 'Enter 18 to 22 digits.');
}

function smsPassword(value: unknown): string | null {
  return optionalPattern(
    value,
    'smsPassword',
    16,
    /^[0-9A-Za-z]{1,16}$/,
    'Use 1 to 16 letters or digits.',
  );
}

/** Installation time from 2000-01-01 up to now. */
function installedAt(value: unknown, clock: FleetClock): Date | null {
  const result = optionalDateTime(value, 'installedAt');
  if (result !== null && result.getTime() > clock.now().getTime()) {
    invalid('installedAt', 'Installation time cannot be in the future.', 'FUTURE_NOT_ALLOWED');
  }
  return result;
}

export function deviceType(input: CreateFleetDeviceInput): FleetDeviceType {
  return optionalEnum(input.type, Object.values(FleetDeviceType), 'type') ?? 'DISCOCAN';
}

export function createDeviceData(input: CreateFleetDeviceInput, clock: FleetClock): DeviceData {
  return {
    imei: imei(input.imei),
    vehicleId: optionalUuid(input.vehicleId, 'vehicleId'),
    model: optionalEnum(input.model, DEVICE_MODELS, 'model'),
    serialNumber: serialNumber(input.serialNumber),
    options: options(input.options),
    firmwareVersion: firmwareVersion(input.firmwareVersion),
    simPhoneNumber: simPhoneNumber(input.simPhoneNumber),
    simIccid: simIccid(input.simIccid),
    smsPassword: smsPassword(input.smsPassword),
    installedAt: installedAt(input.installedAt, clock),
    notes: optionalText(input.notes, 'notes', 2000),
  };
}

export function updateDeviceData(
  input: UpdateFleetDeviceInput,
  clock: FleetClock,
): Partial<DeviceData> {
  const data: Partial<DeviceData> = {};
  if (input.imei !== undefined) {
    data.imei = imei(input.imei);
  }
  if (input.vehicleId !== undefined) {
    data.vehicleId = optionalUuid(input.vehicleId, 'vehicleId');
  }
  if (input.model !== undefined) {
    data.model = optionalEnum(input.model, DEVICE_MODELS, 'model');
  }
  if (input.serialNumber !== undefined) {
    data.serialNumber = serialNumber(input.serialNumber);
  }
  if (input.options !== undefined) {
    data.options = options(input.options);
  }
  if (input.firmwareVersion !== undefined) {
    data.firmwareVersion = firmwareVersion(input.firmwareVersion);
  }
  if (input.simPhoneNumber !== undefined) {
    data.simPhoneNumber = simPhoneNumber(input.simPhoneNumber);
  }
  if (input.simIccid !== undefined) {
    data.simIccid = simIccid(input.simIccid);
  }
  if (input.smsPassword !== undefined) {
    data.smsPassword = smsPassword(input.smsPassword);
  }
  if (input.installedAt !== undefined) {
    data.installedAt = installedAt(input.installedAt, clock);
  }
  if (input.notes !== undefined) {
    data.notes = optionalText(input.notes, 'notes', 2000);
  }
  return data;
}
