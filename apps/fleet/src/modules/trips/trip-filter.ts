import type { FleetTripCondition } from '../../generated/graphql/types.js';
import {
  booleanFilter,
  dateTimeRange,
  filterCondition,
  filterConditions,
  filterRange,
  idList,
  numberFilter,
} from '../../validation.js';

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
  filterConditions(value);
  return value.map((condition: FleetTripCondition | null) => {
    filterCondition(condition, 'trip');
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
    filterRange(distance.distanceKmFrom, distance.distanceKmTo, {
      from: 'distanceKmFrom',
      to: 'distanceKmTo',
    });
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
