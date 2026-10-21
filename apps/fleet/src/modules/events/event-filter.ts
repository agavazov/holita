import type { FleetEventCondition } from '../../generated/graphql/types.js';
import {
  FleetAlertStatus,
  FleetEventKind,
  FleetEventSeverity,
} from '../../generated/prisma/enums.js';
import { booleanFilter, dateTimeRange, enumFilter, idList, invalid } from '../../validation.js';

/** Validated event condition with a half-open occurrence window. */
export type EventConditionCriteria = {
  [K in Exclude<keyof FleetEventCondition, 'occurredFrom' | 'occurredTo'>]?:
    FleetEventCondition[K] | undefined;
} & { occurredFrom?: Date | undefined; occurredTo?: Date | undefined };

export function eventConditions(
  value: readonly FleetEventCondition[] | null | undefined,
): EventConditionCriteria[] | undefined {
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
  return value.map((condition: FleetEventCondition | null) => {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
      invalid('filter', 'filter.allOf: use valid event conditions.', 'INVALID_TYPE');
    }
    const period = dateTimeRange(condition.occurredFrom, condition.occurredTo, {
      from: 'occurredFrom',
      to: 'occurredTo',
    });
    return {
      actionable: booleanFilter(condition.actionable, 'actionable'),
      alertStatuses: enumFilter(
        condition.alertStatuses,
        Object.values(FleetAlertStatus),
        'alertStatuses',
      ),
      excludedAlertStatuses: enumFilter(
        condition.excludedAlertStatuses,
        Object.values(FleetAlertStatus),
        'excludedAlertStatuses',
      ),
      severities: enumFilter(condition.severities, Object.values(FleetEventSeverity), 'severities'),
      excludedSeverities: enumFilter(
        condition.excludedSeverities,
        Object.values(FleetEventSeverity),
        'excludedSeverities',
      ),
      kinds: enumFilter(condition.kinds, Object.values(FleetEventKind), 'kinds'),
      excludedKinds: enumFilter(
        condition.excludedKinds,
        Object.values(FleetEventKind),
        'excludedKinds',
      ),
      vehicleIds: idList(condition.vehicleIds, 'vehicleIds'),
      excludedVehicleIds: idList(condition.excludedVehicleIds, 'excludedVehicleIds'),
      driverIds: idList(condition.driverIds, 'driverIds'),
      excludedDriverIds: idList(condition.excludedDriverIds, 'excludedDriverIds'),
      tripIds: idList(condition.tripIds, 'tripIds'),
      occurredFrom: period.from,
      occurredTo: period.to,
    };
  });
}
