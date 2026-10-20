import type {
  AdminTripsQueryVariables,
  FleetTripCondition,
  FleetTripSortField,
} from '../../../../generated/graphql/operations';
import {
  isComplete,
  type FilterCondition,
  type FilterOperator,
} from '../../../ui/filter-builder/filter-model';
import { fromDateOnly, zonedWallTimeToIso } from '../../../ui/format/zoned-time';
import type { ListQuery } from '../../../ui/list/list-query';
import type { FilterCodec, ListDefinition, ListState } from '../../../ui/list/list-state';
const sorts = {
  startedAt: 'STARTED_AT',
  distance: 'DISTANCE_KM',
  duration: 'DURATION_SECONDS',
  score: 'DRIVING_SCORE',
} satisfies Record<string, FleetTripSortField>;
export type TripSort = keyof typeof sorts;
export interface TripFilters {
  readonly conditions: readonly FilterCondition[];
}
export type TripQueryState = ListState<TripFilters, TripSort>;
const operators: Readonly<Record<string, readonly FilterOperator[]>> = {
  vehicle: ['isAnyOf', 'isNoneOf'],
  driver: ['isAnyOf', 'isNoneOf', 'isEmpty'],
  startedAt: ['on', 'after', 'before', 'between'],
  distance: ['gt', 'lt', 'between'],
  score: ['gt', 'lt'],
  hasEvents: ['isTrue', 'isFalse'],
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
  const type =
    field === 'startedAt'
      ? 'date'
      : ['distance', 'score'].includes(field)
        ? 'number'
        : field === 'hasEvents'
          ? 'boolean'
          : 'text';
  if (!isComplete({ key: field, label: field, type, operators: [operator] }, condition)) {
    return null;
  }
  if (['vehicle', 'driver'].includes(field) && values.some((entry) => !uuid.test(entry))) {
    return null;
  }
  if (field === 'startedAt' && values.some((entry) => !fromDateOnly(entry))) {
    return null;
  }
  if (
    ['distance', 'score'].includes(field) &&
    values.some(
      (entry) =>
        !Number.isFinite(Number(entry)) ||
        Number(entry) < 0 ||
        Number(entry) > (field === 'distance' ? 5000 : 100),
    )
  ) {
    return null;
  }
  return condition;
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
export const tripDefinition: ListDefinition<TripFilters, TripSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'startedAt', field: 'startedAt' },
    { param: 'distance', field: 'distance' },
    { param: 'duration', field: 'duration' },
    { param: 'score', field: 'score' },
  ],
  defaultSort: { field: 'startedAt', direction: 'DESC' },
  filters: { conditions },
};
export function tripViewQuery(state: TripQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? [],
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}
export function tripQueryState(query: ListQuery): TripQueryState {
  const field =
    tripDefinition.sorts.find((sort) => sort.field === query.sort?.field)?.field ?? 'startedAt';
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
    throw new Error('A trip date filter needs a date.');
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
function predicate(condition: FilterCondition, timeZone: string): FleetTripCondition {
  const { field, operator, values } = condition;
  if (field === 'vehicle') {
    return operator === 'isNoneOf'
      ? { excludedVehicleIds: [...values] }
      : { vehicleIds: [...values] };
  }
  if (field === 'driver') {
    return operator === 'isEmpty'
      ? { hasDriver: false }
      : operator === 'isNoneOf'
        ? { excludedDriverIds: [...values] }
        : { driverIds: [...values] };
  }
  if (field === 'distance') {
    return operator === 'between'
      ? { distanceKmFrom: Number(values[0]), distanceKmTo: Number(values[1]) }
      : operator === 'gt'
        ? { distanceKmAbove: Number(values[0]) }
        : { distanceKmBelow: Number(values[0]) };
  }
  if (field === 'score') {
    return operator === 'gt'
      ? { drivingScoreAbove: Number(values[0]) }
      : { drivingScoreBelow: Number(values[0]) };
  }
  if (field === 'hasEvents') {
    return { hasEvents: operator === 'isTrue' };
  }
  if (field === 'startedAt') {
    return operator === 'before'
      ? { startedTo: midnight(values[0], false, timeZone) }
      : operator === 'after'
        ? { startedFrom: midnight(values[0], true, timeZone) }
        : {
            startedFrom: midnight(values[0], false, timeZone),
            startedTo: midnight(operator === 'between' ? values[1] : values[0], true, timeZone),
          };
  }
  throw new Error('Unsupported trip filter.');
}
export function tripVariables(
  state: TripQueryState,
  timeZone = 'Europe/Sofia',
): AdminTripsQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    sort: { field: sorts[state.sort.field], direction: state.sort.direction },
    filter: state.filter.conditions?.length
      ? { allOf: state.filter.conditions.map((condition) => predicate(condition, timeZone)) }
      : null,
  };
}
