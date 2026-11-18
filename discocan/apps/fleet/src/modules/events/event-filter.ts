import type { FleetEventCondition } from '../../generated/graphql/types.js';
import {
  FleetAlertStatus,
  FleetEventKind,
  FleetEventSeverity,
} from '../../generated/prisma/enums.js';
import {
  booleanFilter,
  dateTimeRange,
  enumFilter,
  filterCondition,
  filterConditions,
  idList,
} from '../../validation.js';

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
  filterConditions(value);
  return value.map((condition: FleetEventCondition | null) => {
    filterCondition(condition, 'event');
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
