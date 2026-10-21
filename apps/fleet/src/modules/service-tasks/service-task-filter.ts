import type { FleetServiceTaskCondition } from '../../generated/graphql/types.js';
import {
  FleetServiceStatus,
  FleetServiceType,
  FleetVehicleStatus,
} from '../../generated/prisma/enums.js';
import {
  booleanFilter,
  dateOnlyRange,
  enumFilter,
  idList,
  integerFilter,
  invalid,
  text,
} from '../../validation.js';
import { SERVICE_URGENCIES } from './service-urgency.sql.js';

export type ServiceTaskConditionCriteria = {
  [K in keyof FleetServiceTaskCondition]?: FleetServiceTaskCondition[K] | undefined;
};

/** Repeated filters retain their independent AND meaning and bounded input. */
export function serviceTaskConditions(
  value: readonly FleetServiceTaskCondition[] | null | undefined,
): ServiceTaskConditionCriteria[] | undefined {
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
  return value.map((condition: FleetServiceTaskCondition | null) => {
    if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
      invalid('filter', 'filter.allOf: use valid service conditions.', 'INVALID_TYPE');
    }
    const due = dateOnlyRange(condition.dueOnFrom, condition.dueOnTo, {
      from: 'dueOnFrom',
      to: 'dueOnTo',
    });
    const before = dateOnlyRange(undefined, condition.dueOnBefore, {
      from: 'unused',
      to: 'dueOnBefore',
    });
    const after = dateOnlyRange(condition.dueOnAfter, undefined, {
      from: 'dueOnAfter',
      to: 'unused',
    });
    const completed = dateOnlyRange(condition.completedFrom, condition.completedTo, {
      from: 'completedFrom',
      to: 'completedTo',
    });
    return {
      vehicleStatuses: enumFilter(
        condition.vehicleStatuses,
        Object.values(FleetVehicleStatus),
        'vehicleStatuses',
      ),
      statuses: enumFilter(condition.statuses, Object.values(FleetServiceStatus), 'statuses'),
      excludedStatuses: enumFilter(
        condition.excludedStatuses,
        Object.values(FleetServiceStatus),
        'excludedStatuses',
      ),
      urgencies: enumFilter(condition.urgencies, SERVICE_URGENCIES, 'urgencies'),
      excludedUrgencies: enumFilter(
        condition.excludedUrgencies,
        SERVICE_URGENCIES,
        'excludedUrgencies',
      ),
      serviceTypes: enumFilter(
        condition.serviceTypes,
        Object.values(FleetServiceType),
        'serviceTypes',
      ),
      excludedServiceTypes: enumFilter(
        condition.excludedServiceTypes,
        Object.values(FleetServiceType),
        'excludedServiceTypes',
      ),
      vehicleIds: idList(condition.vehicleIds, 'vehicleIds'),
      excludedVehicleIds: idList(condition.excludedVehicleIds, 'excludedVehicleIds'),
      taskContains:
        condition.taskContains == null
          ? undefined
          : text(condition.taskContains, 'taskContains', 120),
      taskEquals:
        condition.taskEquals == null ? undefined : text(condition.taskEquals, 'taskEquals', 120),
      untitledServiceTypes:
        condition.untitledServiceTypes == null
          ? undefined
          : condition.untitledServiceTypes.length === 0
            ? []
            : enumFilter(
                condition.untitledServiceTypes,
                Object.values(FleetServiceType),
                'untitledServiceTypes',
              ),
      dueOnBefore: before.to,
      dueOnAfter: after.from,
      dueOnFrom: due.from,
      dueOnTo: due.to,
      hasDueOn: booleanFilter(condition.hasDueOn, 'hasDueOn'),
      completedFrom: completed.from,
      completedTo: completed.to,
      costCentsAbove: integerFilter(condition.costCentsAbove, 'costCentsAbove', 0, 100_000_000),
      costCentsBelow: integerFilter(condition.costCentsBelow, 'costCentsBelow', 0, 100_000_000),
      hasCost: booleanFilter(condition.hasCost, 'hasCost'),
    };
  });
}
