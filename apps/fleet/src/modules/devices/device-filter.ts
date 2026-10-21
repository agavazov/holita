import type { FleetDeviceCondition } from '../../generated/graphql/types.js';
import { FleetDeviceModel } from '../../generated/prisma/enums.js';
import { booleanFilter, enumFilter, invalid } from '../../validation.js';
import { DEVICE_STATUSES } from './device-state.js';

export type DeviceConditionCriteria = {
  [K in keyof FleetDeviceCondition]?: FleetDeviceCondition[K] | undefined;
};

function firmware(value: unknown, field: string): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Array.from(value.trim()).length > 32 ||
    value.includes('\u0000')
  ) {
    invalid(
      'filter',
      `filter.${field}: use 1 to 32 supported characters.`,
      typeof value !== 'string'
        ? 'INVALID_TYPE'
        : !value.trim()
          ? 'REQUIRED'
          : Array.from(value.trim()).length > 32
            ? 'TOO_LONG'
            : 'INVALID_FORMAT',
    );
  }
  return value.trim();
}

export function deviceConditions(
  value: readonly FleetDeviceCondition[] | null | undefined,
): DeviceConditionCriteria[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 50) {
    invalid(
      'filter',
      'filter.allOf: use at most 50 conditions.',
      Array.isArray(value) ? 'TOO_MANY_ITEMS' : 'INVALID_TYPE',
    );
  }
  return value.map((condition: FleetDeviceCondition | null) => {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
      invalid('filter', 'filter.allOf: use valid device conditions.', 'INVALID_TYPE');
    }
    return {
      statuses: enumFilter(condition.statuses, DEVICE_STATUSES, 'statuses'),
      excludedStatuses: enumFilter(condition.excludedStatuses, DEVICE_STATUSES, 'excludedStatuses'),
      models: enumFilter(condition.models, Object.values(FleetDeviceModel), 'models'),
      excludedModels: enumFilter(
        condition.excludedModels,
        Object.values(FleetDeviceModel),
        'excludedModels',
      ),
      firmwareVersionEquals: firmware(condition.firmwareVersionEquals, 'firmwareVersionEquals'),
      firmwareVersionNotEquals: firmware(
        condition.firmwareVersionNotEquals,
        'firmwareVersionNotEquals',
      ),
      firmwareVersionStartsWith: firmware(
        condition.firmwareVersionStartsWith,
        'firmwareVersionStartsWith',
      ),
      hasVehicle: booleanFilter(condition.hasVehicle, 'hasVehicle'),
    };
  });
}
