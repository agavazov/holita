import type {
  AdminServiceTasksQueryVariables,
  FleetServiceTaskCondition,
  FleetServiceTaskSortField,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import {
  isComplete,
  type FilterCondition,
  type FilterOperator,
} from '../../../ui/filter-builder/filter-model';
import { fromDateOnly } from '../../../ui/format/zoned-time';
import type { ListQuery } from '../../../ui/list/list-query';
import type { FilterCodec, ListDefinition, ListState } from '../../../ui/list/list-state';
import { vehicleStatuses } from '../vehicles/vehicles-view';
import { maintenanceText } from './i18n/messages';
import { serviceStatuses, serviceTypes, serviceUrgencies } from './service-task';
import { serviceEuroCents } from './service-money';
const sorts = {
  urgency: 'URGENCY',
  dueOn: 'DUE_ON',
  completedOn: 'COMPLETED_ON',
  createdAt: 'CREATED_AT',
  task: 'TASK',
  vehicle: 'VEHICLE_LICENSE_PLATE',
  cost: 'COST_CENTS',
} satisfies Record<string, FleetServiceTaskSortField>;
export type MaintenanceSort = keyof typeof sorts;
export interface MaintenanceFilters {
  readonly conditions: readonly FilterCondition[];
}
export type MaintenanceQueryState = ListState<MaintenanceFilters, MaintenanceSort>;
const operators: Readonly<Record<string, readonly FilterOperator[]>> = {
  urgency: ['isAnyOf', 'isNoneOf'],
  status: ['isAnyOf', 'isNoneOf'],
  serviceType: ['isAnyOf', 'isNoneOf'],
  vehicle: ['isAnyOf', 'isNoneOf'],
  vehicleStatus: ['isAnyOf'],
  task: ['contains', 'equals'],
  dueOn: ['on', 'before', 'after', 'between', 'isEmpty'],
  completedOn: ['on', 'before', 'after', 'between'],
  cost: ['gt', 'lt', 'isEmpty'],
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
  const operator = operators[value.field]?.find((entry) => entry === value.operator);
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
  const type = ['dueOn', 'completedOn'].includes(field)
    ? 'date'
    : field === 'cost'
      ? 'number'
      : 'text';
  if (
    !isComplete(
      {
        key: field,
        label: field,
        type,
        operators: [operator],
        ...(field === 'cost' ? { decimalPlaces: 2, min: 0, max: 1_000_000 } : {}),
      },
      condition,
    )
  ) {
    return null;
  }
  if (field === 'vehicle' && values.some((entry) => !uuid.test(entry))) {
    return null;
  }
  if (['dueOn', 'completedOn'].includes(field) && values.some((entry) => !fromDateOnly(entry))) {
    return null;
  }
  if (field === 'cost' && values.some((entry) => serviceEuroCents(entry) === null)) {
    return null;
  }
  if (field === 'task' && values.some((entry) => Array.from(entry.trim()).length > 120)) {
    return null;
  }
  const allowed =
    field === 'urgency'
      ? serviceUrgencies
      : field === 'status'
        ? serviceStatuses
        : field === 'serviceType'
          ? serviceTypes
          : field === 'vehicleStatus'
            ? vehicleStatuses
            : null;
  return allowed && values.some((entry) => !allowed.some((code) => code === entry))
    ? null
    : condition;
}
const conditions: FilterCodec<readonly FilterCondition[]> = {
  read(values) {
    const raw = values.join(',');
    if (!raw || raw.length > 250_000) {
      return undefined;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return undefined;
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
      return result.length ? result : undefined;
    } catch {
      return undefined;
    }
  },
  write: (value) => (value?.length ? JSON.stringify(value) : null),
  same: (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []),
};
export const maintenanceDefinition: ListDefinition<MaintenanceFilters, MaintenanceSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'urgency', field: 'urgency' },
    { param: 'dueOn', field: 'dueOn' },
    { param: 'completedOn', field: 'completedOn' },
    { param: 'createdAt', field: 'createdAt' },
    { param: 'task', field: 'task' },
    { param: 'vehicle', field: 'vehicle' },
    { param: 'cost', field: 'cost' },
  ],
  defaultSort: { field: 'urgency', direction: 'ASC' },
  filters: { conditions },
};
export function maintenanceViewQuery(state: MaintenanceQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? [],
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}
export function maintenanceQueryState(query: ListQuery): MaintenanceQueryState {
  const field =
    maintenanceDefinition.sorts.find((sort) => sort.field === query.sort?.field)?.field ??
    'urgency';
  return {
    search: query.search,
    filter: { conditions: query.conditions },
    sort: { field, direction: query.sort?.direction === 'desc' ? 'DESC' : 'ASC' },
    page: query.page,
    pageSize: query.pageSize,
  };
}
function day(value: string | undefined, delta = 0): string {
  if (!value) {
    throw new Error('A service date filter needs a date.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
function predicate(condition: FilterCondition, language: Language): FleetServiceTaskCondition {
  const { field, operator, values } = condition;
  if (field === 'status') {
    const codes = serviceStatuses.filter((code) => values.includes(code));
    return operator === 'isNoneOf' ? { excludedStatuses: codes } : { statuses: codes };
  }
  if (field === 'urgency') {
    const codes = serviceUrgencies.filter((code) => values.includes(code));
    return operator === 'isNoneOf' ? { excludedUrgencies: codes } : { urgencies: codes };
  }
  if (field === 'serviceType') {
    const codes = serviceTypes.filter((code) => values.includes(code));
    return operator === 'isNoneOf' ? { excludedServiceTypes: codes } : { serviceTypes: codes };
  }
  if (field === 'vehicle') {
    return operator === 'isNoneOf'
      ? { excludedVehicleIds: [...values] }
      : { vehicleIds: [...values] };
  }
  if (field === 'vehicleStatus') {
    return { vehicleStatuses: vehicleStatuses.filter((code) => values.includes(code)) };
  }
  if (field === 'task') {
    const text = (values[0] ?? '').trim();
    const needle = text.toLocaleLowerCase(language);
    const labels = maintenanceText(language).serviceTypes;
    const untitledServiceTypes = serviceTypes.filter((type) =>
      operator === 'equals'
        ? labels[type].toLocaleLowerCase(language) === needle
        : labels[type].toLocaleLowerCase(language).includes(needle),
    );
    return {
      ...(operator === 'equals' ? { taskEquals: text } : { taskContains: text }),
      untitledServiceTypes,
    };
  }
  if (field === 'dueOn') {
    return operator === 'isEmpty'
      ? { hasDueOn: false }
      : operator === 'before'
        ? { dueOnBefore: day(values[0]) }
        : operator === 'after'
          ? { dueOnAfter: day(values[0]) }
          : {
              dueOnFrom: day(values[0]),
              dueOnTo: day(operator === 'between' ? values[1] : values[0]),
            };
  }
  if (field === 'completedOn') {
    return operator === 'before'
      ? { completedTo: day(values[0], -1) }
      : operator === 'after'
        ? { completedFrom: day(values[0], 1) }
        : {
            completedFrom: day(values[0]),
            completedTo: day(operator === 'between' ? values[1] : values[0]),
          };
  }
  if (field === 'cost') {
    if (operator === 'isEmpty') {
      return { hasCost: false };
    }
    const cents = serviceEuroCents(values[0] ?? '');
    if (cents === null) {
      throw new Error('A service cost filter needs an exact EUR amount.');
    }
    return operator === 'gt' ? { costCentsAbove: cents } : { costCentsBelow: cents };
  }
  throw new Error('Unsupported service filter.');
}
export function maintenanceVariables(
  state: MaintenanceQueryState,
  language: Language,
): AdminServiceTasksQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    sort: { field: sorts[state.sort.field], direction: state.sort.direction },
    filter: state.filter.conditions?.length
      ? { allOf: state.filter.conditions.map((condition) => predicate(condition, language)) }
      : null,
  };
}
