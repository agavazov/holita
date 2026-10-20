import type {
  AdminDriversQueryVariables,
  FleetDriverCondition,
  FleetDriverSortField,
} from '../../../../generated/graphql/operations';
import {
  isComplete,
  type FilterCondition,
  type FilterField,
} from '../../../ui/filter-builder/filter-model';
import { fromDateOnly } from '../../../ui/format/zoned-time';
import type { ListQuery } from '../../../ui/list/list-query';
import type { FilterCodec, ListDefinition, ListState } from '../../../ui/list/list-state';
import { driverLicenseCategories, driverStatuses } from './drivers-view';

const sortFields = {
  name: 'NAME',
  lastName: 'LAST_NAME',
  employeeNo: 'EMPLOYEE_NUMBER',
  status: 'STATUS',
  license: 'LICENSE_EXPIRES_ON',
  tachoCard: 'TACHOGRAPH_CARD_EXPIRES_ON',
  score: 'DRIVING_SCORE_30D',
  trips: 'TRIP_COUNT_30D',
  distance: 'DISTANCE_30D_KM',
  createdAt: 'CREATED_AT',
} satisfies Record<string, FleetDriverSortField>;
export type DriverSort = keyof typeof sortFields;
export interface DriverFilters {
  readonly conditions: readonly FilterCondition[];
}
export type DriverQueryState = ListState<DriverFilters, DriverSort>;

const fields: Readonly<Record<string, Omit<FilterField, 'key' | 'label'>>> = {
  licenseCategories: { type: 'enum', operators: ['isAnyOf'], maxValues: 10 },
  status: { type: 'enum', operators: ['isAnyOf', 'isNoneOf'], maxValues: 3 },
  score: { type: 'number', operators: ['lt', 'gt', 'between', 'isEmpty'], min: 0, max: 100 },
  license: { type: 'date', operators: ['before', 'after', 'between'] },
  tachoCard: { type: 'date', operators: ['before', 'after', 'between'] },
  hasVehicle: { type: 'boolean', operators: ['isTrue', 'isFalse'] },
  trips: { type: 'number', operators: ['gt', 'lt'], min: 0, max: 2_147_483_647, integer: true },
};

function conditionOf(value: unknown): FilterCondition | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('field' in value) ||
    !('operator' in value) ||
    !('values' in value) ||
    !('id' in value) ||
    typeof value.field !== 'string' ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 100 ||
    !Array.isArray(value.values)
  ) {
    return null;
  }
  const definition = fields[value.field];
  const operator = definition?.operators.find((candidate) => candidate === value.operator);
  if (!definition || !operator || value.values.length > 100) {
    return null;
  }
  const values: string[] = [];
  for (const item of value.values) {
    if (typeof item !== 'string' || item.includes('\u0000')) {
      return null;
    }
    values.push(item);
  }
  const condition = { id: value.id, field: value.field, operator, values };
  if (!isComplete({ ...definition, key: value.field, label: value.field }, condition)) {
    return null;
  }
  const allowed =
    value.field === 'status'
      ? driverStatuses
      : value.field === 'licenseCategories'
        ? driverLicenseCategories
        : null;
  if (allowed && values.some((item) => !allowed.some((code) => code === item))) {
    return null;
  }
  if (
    definition.type === 'date' &&
    values.some((item) => !fromDateOnly(item) || item < '1900-01-01' || item > '2100-12-31')
  ) {
    return null;
  }
  return condition;
}

const conditionsCodec: FilterCodec<readonly FilterCondition[]> = {
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
      const conditions: FilterCondition[] = [];
      const ids = new Set<string>();
      for (const value of parsed.slice(0, 50)) {
        const condition = conditionOf(value);
        if (condition && !ids.has(condition.id)) {
          conditions.push(condition);
          ids.add(condition.id);
        }
      }
      return conditions.length ? conditions : undefined;
    } catch {
      return undefined;
    }
  },
  write: (value) => (value?.length ? JSON.stringify(value) : null),
  same: (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []),
};

export const driverDefinition: ListDefinition<DriverFilters, DriverSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'name' },
    { param: 'lastName', field: 'lastName' },
    { param: 'employeeNumber', field: 'employeeNo' },
    { param: 'status', field: 'status' },
    { param: 'license', field: 'license' },
    { param: 'tachoCard', field: 'tachoCard' },
    { param: 'score', field: 'score' },
    { param: 'trips', field: 'trips' },
    { param: 'distance', field: 'distance' },
    { param: 'createdAt', field: 'createdAt' },
  ],
  defaultSort: { field: 'lastName', direction: 'ASC' },
  filters: { conditions: conditionsCodec },
};

export function driverViewQuery(state: DriverQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? [],
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function driverQueryState(query: ListQuery): DriverQueryState {
  const field =
    driverDefinition.sorts.find((sort) => sort.field === query.sort?.field)?.field ?? 'lastName';
  return {
    search: query.search,
    filter: { conditions: query.conditions },
    sort: { field, direction: query.sort?.direction === 'desc' ? 'DESC' : 'ASC' },
    page: query.page,
    pageSize: query.pageSize,
  };
}

function predicate({ field, operator, values }: FilterCondition): FleetDriverCondition {
  switch (field) {
    case 'status': {
      const statuses = driverStatuses.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedStatuses: statuses } : { statuses };
    }
    case 'licenseCategories':
      return { licenseCategories: driverLicenseCategories.filter((code) => values.includes(code)) };
    case 'hasVehicle':
      return { hasVehicle: operator === 'isTrue' };
    case 'score':
      return operator === 'isEmpty'
        ? { hasScore: false }
        : operator === 'between'
          ? { scoreFrom: Number(values[0]), scoreTo: Number(values[1]) }
          : operator === 'gt'
            ? { scoreAbove: Number(values[0]) }
            : { scoreBelow: Number(values[0]) };
    case 'trips':
      return operator === 'gt'
        ? { tripCountAbove: Number(values[0]) }
        : { tripCountBelow: Number(values[0]) };
    case 'license':
      return operator === 'between'
        ? { licenseExpiresOnFrom: values[0], licenseExpiresOnTo: values[1] }
        : operator === 'after'
          ? { licenseExpiresOnAfter: values[0] }
          : { licenseExpiresOnBefore: values[0] };
    case 'tachoCard':
      return operator === 'between'
        ? { tachographCardExpiresOnFrom: values[0], tachographCardExpiresOnTo: values[1] }
        : operator === 'after'
          ? { tachographCardExpiresOnAfter: values[0] }
          : { tachographCardExpiresOnBefore: values[0] };
    default:
      throw new Error('Unsupported Drivers filter.');
  }
}

export function driverVariables(state: DriverQueryState): AdminDriversQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    sort: { field: sortFields[state.sort.field], direction: state.sort.direction },
    filter: state.filter.conditions?.length
      ? { allOf: state.filter.conditions.map(predicate) }
      : null,
  };
}
