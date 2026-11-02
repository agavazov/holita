import type { FleetDriverCondition } from '../../generated/graphql/types.js';
import { FleetDriverStatus, FleetLicenseCategory } from '../../generated/prisma/enums.js';
import {
  booleanFilter,
  dateOnlyRange,
  enumFilter,
  filterCondition,
  filterConditions,
  filterRange,
  idList,
  integerFilter,
  numberFilter,
} from '../../validation.js';

/** Generated condition shape after runtime validation; absent values remain explicit. */
export type DriverConditionCriteria = {
  [K in keyof FleetDriverCondition]?: FleetDriverCondition[K] | undefined;
};

export function driverConditions(
  value: readonly FleetDriverCondition[] | null | undefined,
): DriverConditionCriteria[] | undefined {
  if (value == null) {
    return undefined;
  }
  filterConditions(value);
  return value.map((condition: FleetDriverCondition | null) => {
    filterCondition(condition, 'driver');
    const score = {
      scoreAbove: numberFilter(condition.scoreAbove, 'scoreAbove', 0, 100),
      scoreBelow: numberFilter(condition.scoreBelow, 'scoreBelow', 0, 100),
      scoreFrom: numberFilter(condition.scoreFrom, 'scoreFrom', 0, 100),
      scoreTo: numberFilter(condition.scoreTo, 'scoreTo', 0, 100),
    };
    const distance = {
      distanceKmAbove: numberFilter(condition.distanceKmAbove, 'distanceKmAbove', 0, 10_000_000),
      distanceKmBelow: numberFilter(condition.distanceKmBelow, 'distanceKmBelow', 0, 10_000_000),
      distanceKmFrom: numberFilter(condition.distanceKmFrom, 'distanceKmFrom', 0, 10_000_000),
      distanceKmTo: numberFilter(condition.distanceKmTo, 'distanceKmTo', 0, 10_000_000),
    };
    filterRange(score.scoreFrom, score.scoreTo, { from: 'scoreFrom', to: 'scoreTo' });
    filterRange(distance.distanceKmFrom, distance.distanceKmTo, {
      from: 'distanceKmFrom',
      to: 'distanceKmTo',
    });
    const license = dateOnlyRange(condition.licenseExpiresOnFrom, condition.licenseExpiresOnTo, {
      from: 'licenseExpiresOnFrom',
      to: 'licenseExpiresOnTo',
    });
    const licenseAfter = dateOnlyRange(condition.licenseExpiresOnAfter, undefined, {
      from: 'licenseExpiresOnAfter',
      to: 'unused',
    });
    const licenseBefore = dateOnlyRange(condition.licenseExpiresOnBefore, undefined, {
      from: 'licenseExpiresOnBefore',
      to: 'unused',
    });
    const card = dateOnlyRange(
      condition.tachographCardExpiresOnFrom,
      condition.tachographCardExpiresOnTo,
      {
        from: 'tachographCardExpiresOnFrom',
        to: 'tachographCardExpiresOnTo',
      },
    );
    const cardAfter = dateOnlyRange(condition.tachographCardExpiresOnAfter, undefined, {
      from: 'tachographCardExpiresOnAfter',
      to: 'unused',
    });
    const cardBefore = dateOnlyRange(condition.tachographCardExpiresOnBefore, undefined, {
      from: 'tachographCardExpiresOnBefore',
      to: 'unused',
    });
    return {
      statuses: enumFilter(condition.statuses, Object.values(FleetDriverStatus), 'statuses'),
      excludedStatuses: enumFilter(
        condition.excludedStatuses,
        Object.values(FleetDriverStatus),
        'excludedStatuses',
      ),
      licenseCategories: enumFilter(
        condition.licenseCategories,
        Object.values(FleetLicenseCategory),
        'licenseCategories',
      ),
      hasVehicle: booleanFilter(condition.hasVehicle, 'hasVehicle'),
      vehicleIds: idList(condition.vehicleIds, 'vehicleIds'),
      excludedVehicleIds: idList(condition.excludedVehicleIds, 'excludedVehicleIds'),
      ...score,
      hasScore: booleanFilter(condition.hasScore, 'hasScore'),
      tripCountAbove: integerFilter(condition.tripCountAbove, 'tripCountAbove', 0, 2_147_483_647),
      tripCountBelow: integerFilter(condition.tripCountBelow, 'tripCountBelow', 0, 2_147_483_647),
      ...distance,
      licenseExpiresOnAfter: licenseAfter.from,
      licenseExpiresOnBefore: licenseBefore.from,
      licenseExpiresOnFrom: license.from,
      licenseExpiresOnTo: license.to,
      tachographCardExpiresOnAfter: cardAfter.from,
      tachographCardExpiresOnBefore: cardBefore.from,
      tachographCardExpiresOnFrom: card.from,
      tachographCardExpiresOnTo: card.to,
    };
  });
}
