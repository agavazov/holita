import type { FleetTripCondition } from '../../generated/graphql/types.js';
import { booleanFilter, dateTimeRange, idList, invalid, numberFilter } from '../../validation.js';

/** Generated condition shape with transport instants validated as Dates. */
export type TripConditionCriteria = Omit<
  { [K in keyof FleetTripCondition]?: FleetTripCondition[K] | undefined },
  'startedFrom' | 'startedTo'
> & { startedFrom?: Date | undefined; startedTo?: Date | undefined };

/** Preserve independent conditions, including repeated or contradictory predicates. */
export function tripConditions(
  value: readonly FleetTripCondition[] | null | undefined,
): TripConditionCriteria[] | undefined {
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
  return value.map((condition: FleetTripCondition | null) => {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
      invalid('filter', 'filter.allOf: use valid trip conditions.', 'INVALID_TYPE');
    }
    const period = dateTimeRange(condition.startedFrom, condition.startedTo, {
      from: 'startedFrom',
      to: 'startedTo',
    });
    const distance = {
      distanceKmAbove: numberFilter(condition.distanceKmAbove, 'distanceKmAbove', 0, 5000),
      distanceKmBelow: numberFilter(condition.distanceKmBelow, 'distanceKmBelow', 0, 5000),
      distanceKmFrom: numberFilter(condition.distanceKmFrom, 'distanceKmFrom', 0, 5000),
      distanceKmTo: numberFilter(condition.distanceKmTo, 'distanceKmTo', 0, 5000),
    };
    if (
      distance.distanceKmFrom !== undefined &&
      distance.distanceKmTo !== undefined &&
      distance.distanceKmFrom > distance.distanceKmTo
    ) {
      invalid(
        'filter',
        'filter.distanceKmTo must not be below filter.distanceKmFrom.',
        'INVALID_RANGE',
      );
    }
    return {
      startedFrom: period.from,
      startedTo: period.to,
      vehicleIds: idList(condition.vehicleIds, 'vehicleIds'),
      excludedVehicleIds: idList(condition.excludedVehicleIds, 'excludedVehicleIds'),
      driverIds: idList(condition.driverIds, 'driverIds'),
      excludedDriverIds: idList(condition.excludedDriverIds, 'excludedDriverIds'),
      hasDriver: booleanFilter(condition.hasDriver, 'hasDriver'),
      ...distance,
      drivingScoreAbove: numberFilter(condition.drivingScoreAbove, 'drivingScoreAbove', 0, 100),
      drivingScoreBelow: numberFilter(condition.drivingScoreBelow, 'drivingScoreBelow', 0, 100),
      hasEvents: booleanFilter(condition.hasEvents, 'hasEvents'),
    };
  });
}
