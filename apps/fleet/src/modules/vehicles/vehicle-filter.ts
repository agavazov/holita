import type { FleetVehicleCondition } from '../../generated/graphql/types.js';
import {
  FleetFuelType,
  FleetVehicleStatus,
  FleetVehicleType,
} from '../../generated/prisma/enums.js';
import {
  booleanFilter,
  dateOnlyRange,
  enumFilter,
  idList,
  integerFilter,
  invalid,
  textErrorCode,
  numberFilter,
} from '../../validation.js';

const ACTIVITIES = ['MOVING', 'IDLE', 'PARKED', 'ASSET', 'NOT_CONNECTED', 'NO_DEVICE'] as const;

/** Generated condition shape with validated absent values represented explicitly. */
export type VehicleConditionCriteria = {
  [K in keyof FleetVehicleCondition]?: FleetVehicleCondition[K] | undefined;
};

function makeFilter(value: unknown, field: string): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Array.from(value.trim()).length > 64 ||
    value.includes('\u0000')
  ) {
    invalid(
      'filter',
      `filter.${field}: use 1 to 64 supported characters.`,
      textErrorCode(value, 64),
    );
  }
  return value.trim();
}

/** Each entry remains separate: repeated and contradictory conditions retain their AND meaning. */
export function vehicleConditions(
  value: readonly FleetVehicleCondition[] | null | undefined,
): VehicleConditionCriteria[] | undefined {
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
  return value.map((condition: FleetVehicleCondition | null) => {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
      invalid('filter', 'filter.allOf: use valid vehicle conditions.', 'INVALID_TYPE');
    }
    const years = {
      modelYearEquals: integerFilter(condition.modelYearEquals, 'modelYearEquals', 1950, 2100),
      modelYearAbove: integerFilter(condition.modelYearAbove, 'modelYearAbove', 1950, 2100),
      modelYearBelow: integerFilter(condition.modelYearBelow, 'modelYearBelow', 1950, 2100),
      modelYearFrom: integerFilter(condition.modelYearFrom, 'modelYearFrom', 1950, 2100),
      modelYearTo: integerFilter(condition.modelYearTo, 'modelYearTo', 1950, 2100),
    };
    const odometer = {
      odometerKmAbove: numberFilter(condition.odometerKmAbove, 'odometerKmAbove', 0, 10_000_000),
      odometerKmBelow: numberFilter(condition.odometerKmBelow, 'odometerKmBelow', 0, 10_000_000),
      odometerKmFrom: numberFilter(condition.odometerKmFrom, 'odometerKmFrom', 0, 10_000_000),
      odometerKmTo: numberFilter(condition.odometerKmTo, 'odometerKmTo', 0, 10_000_000),
    };
    if (
      years.modelYearFrom !== undefined &&
      years.modelYearTo !== undefined &&
      years.modelYearFrom > years.modelYearTo
    ) {
      invalid(
        'filter',
        'filter.modelYearTo must not be below filter.modelYearFrom.',
        'INVALID_RANGE',
      );
    }
    if (
      odometer.odometerKmFrom !== undefined &&
      odometer.odometerKmTo !== undefined &&
      odometer.odometerKmFrom > odometer.odometerKmTo
    ) {
      invalid(
        'filter',
        'filter.odometerKmTo must not be below filter.odometerKmFrom.',
        'INVALID_RANGE',
      );
    }
    const dates = dateOnlyRange(condition.createdOnFrom, condition.createdOnTo, {
      from: 'createdOnFrom',
      to: 'createdOnTo',
    });
    const after = dateOnlyRange(condition.createdOnAfter, undefined, {
      from: 'createdOnAfter',
      to: 'unused',
    });
    const before = dateOnlyRange(condition.createdOnBefore, undefined, {
      from: 'createdOnBefore',
      to: 'unused',
    });
    return {
      statuses: enumFilter(condition.statuses, Object.values(FleetVehicleStatus), 'statuses'),
      excludedStatuses: enumFilter(
        condition.excludedStatuses,
        Object.values(FleetVehicleStatus),
        'excludedStatuses',
      ),
      activities: enumFilter(condition.activities, ACTIVITIES, 'activities'),
      excludedActivities: enumFilter(
        condition.excludedActivities,
        ACTIVITIES,
        'excludedActivities',
      ),
      vehicleTypes: enumFilter(
        condition.vehicleTypes,
        Object.values(FleetVehicleType),
        'vehicleTypes',
      ),
      excludedVehicleTypes: enumFilter(
        condition.excludedVehicleTypes,
        Object.values(FleetVehicleType),
        'excludedVehicleTypes',
      ),
      groupIds: idList(condition.groupIds, 'groupIds'),
      excludedGroupIds: idList(condition.excludedGroupIds, 'excludedGroupIds'),
      hasGroup: booleanFilter(condition.hasGroup, 'hasGroup'),
      fuelTypes: enumFilter(condition.fuelTypes, Object.values(FleetFuelType), 'fuelTypes'),
      currentDriverIds: idList(condition.currentDriverIds, 'currentDriverIds'),
      hasDriver: booleanFilter(condition.hasDriver, 'hasDriver'),
      hasDevice: booleanFilter(condition.hasDevice, 'hasDevice'),
      hasOpenAlerts: booleanFilter(condition.hasOpenAlerts, 'hasOpenAlerts'),
      makeContains: makeFilter(condition.makeContains, 'makeContains'),
      makeEquals: makeFilter(condition.makeEquals, 'makeEquals'),
      ...years,
      ...odometer,
      createdOnAfter: after.from,
      createdOnBefore: before.from,
      createdOnFrom: dates.from,
      createdOnTo: dates.to,
    };
  });
}
