import {
  MEASUREMENT_CONFIGURATION_OPERATIONS,
  MEASUREMENT_DEFINITION_HEX,
  MEASUREMENT_GLOBALS_HEX,
  type DeviceMeasurementConfigurationChange,
  type DeviceParameterWrite,
} from '@discocan/device-contract';
import type {
  FleetDeviceParameterWriteInput,
  StartDeviceMeasurementConfigurationChangeInput,
} from '../../generated/graphql/types.js';
import { enumValue, integer, invalid } from '../../validation.js';

const measurementFields = {
  READ: [],
  INTERVAL: ['parameterId', 'intervalSeconds'],
  ADD_DEFINITION: ['definitionHex'],
  GLOBALS: ['globalsHex'],
} as const;

function hex(value: string | null | undefined, path: string, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    invalid(path, 'Supply the documented Simple eData bytes in hexadecimal.', 'INVALID_FORMAT');
  }
  return value;
}

export function measurementChangeInput(
  input: StartDeviceMeasurementConfigurationChangeInput,
): DeviceMeasurementConfigurationChange {
  const operation = enumValue(input.operation, MEASUREMENT_CONFIGURATION_OPERATIONS, 'operation');
  const restoreAfter = input.restoreAfter ?? false;
  const values = {
    parameterId: input.parameterId,
    intervalSeconds: input.intervalSeconds,
    definitionHex: input.definitionHex,
    globalsHex: input.globalsHex,
  };
  const allowedFields: readonly string[] = measurementFields[operation];
  if (
    Object.entries(values).some(([key, value]) => value != null && !allowedFields.includes(key))
  ) {
    invalid('operation', 'Supply only the fields for the selected measurement operation.');
  }
  switch (operation) {
    case 'READ':
      if (restoreAfter) {
        invalid('restoreAfter', 'Restoration applies only to configuration writes.');
      }
      return { operation, restoreAfter: false };
    case 'INTERVAL':
      return {
        operation,
        parameterId: integer(input.parameterId, 'parameterId', 0, 65535),
        intervalSeconds: integer(input.intervalSeconds, 'intervalSeconds', 0, 65000),
        restoreAfter,
      };
    case 'ADD_DEFINITION':
      return {
        operation,
        definitionHex: hex(input.definitionHex, 'definitionHex', MEASUREMENT_DEFINITION_HEX),
        restoreAfter,
      };
    case 'GLOBALS':
      return {
        operation,
        globalsHex: hex(input.globalsHex, 'globalsHex', MEASUREMENT_GLOBALS_HEX),
        restoreAfter,
      };
  }
}

export function parameterWriteInput({
  parameterId,
  value,
}: FleetDeviceParameterWriteInput): DeviceParameterWrite {
  if (typeof parameterId !== 'string' || !parameterId.trim() || parameterId.includes('\0')) {
    invalid(
      'parameterId',
      'Choose a parameter identifier from the Device catalog.',
      'INVALID_FORMAT',
    );
  }
  if (typeof value !== 'string' || value.includes('\0')) {
    invalid('value', 'Supply a supported parameter value.', 'INVALID_FORMAT');
  }
  return { parameterId, value };
}

export function parameterWritesInput(
  input: FleetDeviceParameterWriteInput[],
): DeviceParameterWrite[] {
  if (!Array.isArray(input) || input.length === 0) {
    invalid('parameters', 'Choose at least one parameter.', 'REQUIRED');
  }
  const parameters = input.map(parameterWriteInput);
  if (new Set(parameters.map(({ parameterId }) => parameterId)).size !== parameters.length) {
    invalid('parameters', 'Choose distinct parameter identifiers.', 'DUPLICATE_VALUE');
  }
  return parameters;
}
