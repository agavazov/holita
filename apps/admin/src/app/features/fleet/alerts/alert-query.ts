import type {
  AdminAlertsQueryVariables,
  FleetEventCondition,
  FleetEventSortField,
} from '../../../../generated/graphql/operations';
import {
  isComplete,
  type FilterCondition,
  type FilterOperator,
} from '../../../ui/filter-builder/filter-model';
import { fromDateOnly, zonedWallTimeToIso } from '../../../ui/format/zoned-time';
import type { ListQuery } from '../../../ui/list/list-query';
import type { FilterCodec, ListDefinition, ListState } from '../../../ui/list/list-state';
import { alertSeverities, alertStatuses } from './alerts-view';

const sorts = {
  severity: 'SEVERITY',
  status: 'ALERT_STATUS',
  occurredAt: 'OCCURRED_AT',
} satisfies Record<string, FleetEventSortField>;
export type AlertSort = keyof typeof sorts;
export interface AlertFilters {
  readonly conditions: readonly FilterCondition[];
}
export type AlertQueryState = ListState<AlertFilters, AlertSort>;
export const defaultAlertConditions: readonly FilterCondition[] = [
  { id: 'default-status', field: 'status', operator: 'isNoneOf', values: ['RESOLVED'] },
];
const operators: Readonly<Record<string, readonly FilterOperator[]>> = {
  severity: ['isAnyOf', 'isNoneOf'],
  status: ['isAnyOf', 'isNoneOf'],
  vehicle: ['isAnyOf', 'isNoneOf'],
  occurredAt: ['on', 'after', 'before', 'between'],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function conditionOf(value: unknown): FilterCondition | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 100 ||
    !('field' in value) ||
    typeof value.field !== 'string' ||
    !('operator' in value) ||
    !('values' in value) ||
    !Array.isArray(value.values) ||
    value.values.length > 100
  ) {
    return null;
  }
  const operator = operators[value.field]?.find((candidate) => candidate === value.operator);
  if (!operator) {
    return null;
  }
  const values: string[] = [];
  for (const entry of value.values) {
    if (typeof entry !== 'string' || entry.includes('\u0000')) {
      return null;
    }
    values.push(entry);
  }
  const field = value.field;
  const condition = { id: value.id, field, operator, values };
  if (
    !isComplete(
      {
        key: field,
        label: field,
        type: field === 'occurredAt' ? 'date' : 'text',
        operators: [operator],
      },
      condition,
    )
  ) {
    return null;
  }
  if (field === 'vehicle' && values.some((entry) => !uuid.test(entry))) {
    return null;
  }
  if (field === 'occurredAt' && values.some((entry) => !fromDateOnly(entry))) {
    return null;
  }
  const allowed =
    field === 'severity' ? alertSeverities : field === 'status' ? alertStatuses : null;
  return allowed && values.some((entry) => !allowed.some((code) => code === entry))
    ? null
    : condition;
}
const conditions: FilterCodec<readonly FilterCondition[]> = {
  read(values) {
    if (!values.length) {
      return defaultAlertConditions;
    }
    const raw = values.join(',');
    if (raw.length > 250_000) {
      return defaultAlertConditions;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return defaultAlertConditions;
      }
      const result: FilterCondition[] = [];
      const ids = new Set<string>();
      for (const value of parsed.slice(0, 50)) {
        const condition = conditionOf(value);
        if (condition && !ids.has(condition.id)) {
          result.push(condition);
          ids.add(condition.id);
        }
      }
      return result;
    } catch {
      return defaultAlertConditions;
    }
  },
  write: (value) =>
    JSON.stringify(value ?? defaultAlertConditions) === JSON.stringify(defaultAlertConditions)
      ? null
      : JSON.stringify(value ?? []),
  same: (a, b) =>
    JSON.stringify(a ?? defaultAlertConditions) === JSON.stringify(b ?? defaultAlertConditions),
};
export const alertDefinition: ListDefinition<AlertFilters, AlertSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'severity', field: 'severity' },
    { param: 'status', field: 'status' },
    { param: 'occurredAt', field: 'occurredAt' },
  ],
  defaultSort: { field: 'occurredAt', direction: 'DESC' },
  filters: { conditions },
};
export function alertViewQuery(state: AlertQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? defaultAlertConditions,
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}
export function alertQueryState(query: ListQuery): AlertQueryState {
  const field =
    alertDefinition.sorts.find((sort) => sort.field === query.sort?.field)?.field ?? 'occurredAt';
  return {
    search: query.search,
    filter: { conditions: query.conditions },
    sort: { field, direction: query.sort?.direction === 'asc' ? 'ASC' : 'DESC' },
    page: query.page,
    pageSize: query.pageSize,
  };
}
function midnight(value: string | undefined, nextDay: boolean, timeZone: string): string {
  if (!value) {
    throw new Error('An alert date filter needs a date.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (nextDay) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return zonedWallTimeToIso(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
}
function predicate(condition: FilterCondition, timeZone: string): FleetEventCondition {
  const { field, operator, values } = condition;
  if (field === 'severity') {
    const codes = alertSeverities.filter((code) => values.includes(code));
    return operator === 'isNoneOf' ? { excludedSeverities: codes } : { severities: codes };
  }
  if (field === 'status') {
    const codes = alertStatuses.filter((code) => values.includes(code));
    return operator === 'isNoneOf' ? { excludedAlertStatuses: codes } : { alertStatuses: codes };
  }
  if (field === 'vehicle') {
    return operator === 'isNoneOf'
      ? { excludedVehicleIds: [...values] }
      : { vehicleIds: [...values] };
  }
  if (field === 'occurredAt') {
    return operator === 'before'
      ? { occurredTo: midnight(values[0], false, timeZone) }
      : operator === 'after'
        ? { occurredFrom: midnight(values[0], true, timeZone) }
        : {
            occurredFrom: midnight(values[0], false, timeZone),
            occurredTo: midnight(operator === 'between' ? values[1] : values[0], true, timeZone),
          };
  }
  throw new Error('Unsupported alert filter.');
}
export function alertVariables(
  state: AlertQueryState,
  timeZone = 'Europe/Sofia',
): AdminAlertsQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    sort: { field: sorts[state.sort.field], direction: state.sort.direction },
    filter: {
      actionable: true,
      allOf: (state.filter.conditions ?? defaultAlertConditions).map((condition) =>
        predicate(condition, timeZone),
      ),
    },
  };
}
