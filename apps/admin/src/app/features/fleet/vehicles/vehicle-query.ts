import type {
  FleetVehicleCondition,
  FleetVehicleSortField,
  AdminVehiclesQueryVariables,
} from '../../../../generated/graphql/operations';
import {
  isComplete,
  type FilterCondition,
  type FilterOperator,
} from '../../../ui/filter-builder/filter-model';
import type { ListQuery } from '../../../ui/list/list-query';
import { type FilterCodec, type ListDefinition, type ListState } from '../../../ui/list/list-state';
import { vehicleActivities, vehicleStatuses, vehicleTypes } from './vehicles-view';
import { vehicleFuelTypes } from './vehicle-drawer';

const sortFields = {
  plate: 'LICENSE_PLATE',
  fleetNumber: 'FLEET_NUMBER',
  status: 'STATUS',
  lastReportedAt: 'LAST_REPORTED_AT',
  odometer: 'ODOMETER_KM',
  createdAt: 'CREATED_AT',
  updatedAt: 'UPDATED_AT',
} satisfies Record<string, FleetVehicleSortField>;
export type VehicleSort = keyof typeof sortFields;
export interface VehicleFilters {
  readonly conditions: readonly FilterCondition[];
}
export type VehicleQueryState = ListState<VehicleFilters, VehicleSort>;

const operators: Readonly<Record<string, readonly FilterOperator[]>> = {
  status: ['isAnyOf', 'isNoneOf'],
  activity: ['isAnyOf', 'isNoneOf'],
  group: ['isAnyOf', 'isNoneOf', 'isEmpty'],
  type: ['isAnyOf', 'isNoneOf'],
  make: ['contains', 'equals'],
  odometer: ['gt', 'lt', 'between'],
  year: ['equals', 'gt', 'lt', 'between'],
  hasDriver: ['isTrue', 'isFalse'],
  fuelType: ['isAnyOf'],
  driver: ['isAnyOf'],
  hasDevice: ['isTrue', 'isFalse'],
  hasOpenAlerts: ['isTrue', 'isFalse'],
  createdAt: ['after', 'before', 'between'],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const field = value.field;
  const operator = operators[field]?.find((candidate) => candidate === value.operator);
  if (!operator || value.values.length > 100) {
    return null;
  }
  const values: string[] = [];
  for (const candidate of value.values) {
    if (typeof candidate !== 'string' || candidate.includes('\u0000')) {
      return null;
    }
    values.push(candidate);
  }
  const condition = { id: value.id, field, operator, values };
  const type = ['year', 'odometer'].includes(field)
    ? 'number'
    : field === 'createdAt'
      ? 'date'
      : 'text';
  if (!isComplete({ key: field, label: field, type, operators: [operator] }, condition)) {
    return null;
  }
  const allowed =
    field === 'status'
      ? vehicleStatuses
      : field === 'activity'
        ? vehicleActivities
        : field === 'type'
          ? vehicleTypes
          : field === 'fuelType'
            ? vehicleFuelTypes
            : null;
  if (allowed && values.some((entry) => !allowed.some((code) => code === entry))) {
    return null;
  }
  if (['driver', 'group'].includes(field) && values.some((entry) => !uuid.test(entry))) {
    return null;
  }
  if (field === 'make' && values.some((entry) => Array.from(entry.trim()).length > 64)) {
    return null;
  }
  if (
    field === 'year' &&
    values.some(
      (entry) => !Number.isInteger(Number(entry)) || Number(entry) < 1950 || Number(entry) > 2100,
    )
  ) {
    return null;
  }
  if (
    field === 'odometer' &&
    values.some(
      (entry) => !Number.isFinite(Number(entry)) || Number(entry) < 0 || Number(entry) > 10_000_000,
    )
  ) {
    return null;
  }
  if (
    field === 'createdAt' &&
    values.some(
      (entry) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(entry) ||
        !Number.isFinite(Date.parse(entry)) ||
        new Date(entry).toISOString().slice(0, 10) !== entry,
    )
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

export const vehicleDefinition: ListDefinition<VehicleFilters, VehicleSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'licensePlate', field: 'plate' },
    { param: 'fleetNumber', field: 'fleetNumber' },
    { param: 'status', field: 'status' },
    { param: 'lastReportedAt', field: 'lastReportedAt' },
    { param: 'odometer', field: 'odometer' },
    { param: 'createdAt', field: 'createdAt' },
    { param: 'updatedAt', field: 'updatedAt' },
  ],
  defaultSort: { field: 'plate', direction: 'ASC' },
  filters: { conditions: conditionsCodec },
};

export function vehicleViewQuery(state: VehicleQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? [],
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function vehicleQueryState(query: ListQuery): VehicleQueryState {
  const field =
    vehicleDefinition.sorts.find((sort) => sort.field === query.sort?.field)?.field ?? 'plate';
  return {
    search: query.search,
    filter: { conditions: query.conditions },
    sort: { field, direction: query.sort?.direction === 'desc' ? 'DESC' : 'ASC' },
    page: query.page,
    pageSize: query.pageSize,
  };
}

function predicate(condition: FilterCondition): FleetVehicleCondition {
  const { field, operator, values } = condition;
  switch (field) {
    case 'status': {
      const codes = vehicleStatuses.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedStatuses: codes } : { statuses: codes };
    }
    case 'activity': {
      const codes = vehicleActivities.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedActivities: codes } : { activities: codes };
    }
    case 'type': {
      const codes = vehicleTypes.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedVehicleTypes: codes } : { vehicleTypes: codes };
    }
    case 'group':
      return operator === 'isEmpty'
        ? { hasGroup: false }
        : operator === 'isNoneOf'
          ? { excludedGroupIds: [...values] }
          : { groupIds: [...values] };
    case 'driver':
      return { currentDriverIds: [...values] };
    case 'fuelType':
      return { fuelTypes: vehicleFuelTypes.filter((code) => values.includes(code)) };
    case 'hasDriver':
      return { hasDriver: operator === 'isTrue' };
    case 'hasDevice':
      return { hasDevice: operator === 'isTrue' };
    case 'hasOpenAlerts':
      return { hasOpenAlerts: operator === 'isTrue' };
    case 'make':
      return operator === 'equals' ? { makeEquals: values[0] } : { makeContains: values[0] };
    case 'year':
      return operator === 'between'
        ? { modelYearFrom: Number(values[0]), modelYearTo: Number(values[1]) }
        : operator === 'gt'
          ? { modelYearAbove: Number(values[0]) }
          : operator === 'lt'
            ? { modelYearBelow: Number(values[0]) }
            : { modelYearEquals: Number(values[0]) };
    case 'odometer':
      return operator === 'between'
        ? { odometerKmFrom: Number(values[0]), odometerKmTo: Number(values[1]) }
        : operator === 'gt'
          ? { odometerKmAbove: Number(values[0]) }
          : { odometerKmBelow: Number(values[0]) };
    case 'createdAt':
      return operator === 'between'
        ? { createdOnFrom: values[0], createdOnTo: values[1] }
        : operator === 'after'
          ? { createdOnAfter: values[0] }
          : { createdOnBefore: values[0] };
    default:
      throw new Error('Unsupported Vehicles filter.');
  }
}

export function vehicleVariables(state: VehicleQueryState): AdminVehiclesQueryVariables {
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
