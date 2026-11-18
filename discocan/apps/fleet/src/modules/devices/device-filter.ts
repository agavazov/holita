import type { FleetDeviceCondition } from '../../generated/graphql/types.js';
import { FleetDeviceModel } from '../../generated/prisma/enums.js';
import {
  booleanFilter,
  enumFilter,
  filterCondition,
  filterConditions,
  textFilter,
} from '../../validation.js';
import { DEVICE_STATUSES } from './device-state.js';

export type DeviceConditionCriteria = {
  [K in keyof FleetDeviceCondition]?: FleetDeviceCondition[K] | undefined;
};

export function deviceConditions(
  value: readonly FleetDeviceCondition[] | null | undefined,
): DeviceConditionCriteria[] | undefined {
  if (value == null) {
    return undefined;
  }
  filterConditions(value);
  return value.map((condition: FleetDeviceCondition | null) => {
    filterCondition(condition, 'device');
    return {
      statuses: enumFilter(condition.statuses, DEVICE_STATUSES, 'statuses'),
      excludedStatuses: enumFilter(condition.excludedStatuses, DEVICE_STATUSES, 'excludedStatuses'),
      models: enumFilter(condition.models, Object.values(FleetDeviceModel), 'models'),
      excludedModels: enumFilter(
        condition.excludedModels,
        Object.values(FleetDeviceModel),
        'excludedModels',
      ),
      firmwareVersionEquals: textFilter(
        condition.firmwareVersionEquals,
        'firmwareVersionEquals',
        32,
      ),
      firmwareVersionNotEquals: textFilter(
        condition.firmwareVersionNotEquals,
        'firmwareVersionNotEquals',
        32,
      ),
      firmwareVersionStartsWith: textFilter(
        condition.firmwareVersionStartsWith,
        'firmwareVersionStartsWith',
        32,
      ),
      hasVehicle: booleanFilter(condition.hasVehicle, 'hasVehicle'),
    };
  });
}
