import type {
  AdminDevicesQueryVariables,
  FleetDeviceCondition,
  FleetDeviceSortField,
} from '../../../../generated/graphql/operations';
import {
  isComplete,
  type FilterCondition,
  type FilterOperator,
} from '../../../ui/filter-builder/filter-model';
import type { ListQuery } from '../../../ui/list/list-query';
import type { FilterCodec, ListDefinition, ListState } from '../../../ui/list/list-state';
import { deviceStatuses } from './devices-view';

export const deviceModels = ['STARLINK_TRACKER', 'STARLINK_SCOUT', 'OTHER'] as const;
export const deviceOptions = [
  'CELLULAR_4G',
  'SAFETY_SF',
  'IRF',
  'CAN',
  'DRIVER_ID',
  'GEOZONES_GO',
  'TEMPERATURE_DS',
  'ECONNECT',
  'WIFI',
  'VOICE',
  'EXTERNAL_ANTENNA',
  'RS232',
  'WILIOT',
] as const;
const sorts = {
  imei: 'IMEI',
  status: 'STATUS',
  vehicle: 'VEHICLE_LICENSE_PLATE',
  lastSeenAt: 'LAST_REPORTED_AT',
  installedAt: 'INSTALLED_AT',
  createdAt: 'CREATED_AT',
} satisfies Record<string, FleetDeviceSortField>;
type DeviceSort = keyof typeof sorts;
interface DeviceFilters {
  readonly conditions: readonly FilterCondition[];
}
export type DeviceQueryState = ListState<DeviceFilters, DeviceSort>;
const operators: Readonly<Record<string, readonly FilterOperator[]>> = {
  status: ['isAnyOf', 'isNoneOf'],
  model: ['isAnyOf', 'isNoneOf'],
  firmware: ['equals', 'notEquals', 'startsWith'],
  installed: ['isTrue', 'isFalse'],
};

function conditionOf(value: unknown): FilterCondition | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('field' in value) ||
    !('operator' in value) ||
    !('values' in value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 100 ||
    typeof value.field !== 'string' ||
    !Array.isArray(value.values) ||
    value.values.length > 100
  ) {
    return null;
  }
  const field = value.field;
  const operator = operators[field]?.find((entry) => entry === value.operator);
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
  const condition = { id: value.id, field, operator, values };
  if (
    !isComplete(
      {
        key: field,
        label: field,
        type: field === 'firmware' ? 'text' : field === 'installed' ? 'boolean' : 'enum',
        operators: [operator],
        ...(field === 'firmware' ? { maxLength: 32 } : {}),
        maxValues: 100,
      },
      condition,
    )
  ) {
    return null;
  }
  const allowed = field === 'status' ? deviceStatuses : field === 'model' ? deviceModels : null;
  if (allowed && values.some((entry) => !allowed.some((code) => code === entry))) {
    return null;
  }
  return condition;
}
const codec: FilterCodec<readonly FilterCondition[]> = {
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
      for (const entry of parsed.slice(0, 50)) {
        const condition = conditionOf(entry);
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
export const deviceDefinition: ListDefinition<DeviceFilters, DeviceSort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'imei', field: 'imei' },
    { param: 'status', field: 'status' },
    { param: 'vehicle', field: 'vehicle' },
    { param: 'lastSeenAt', field: 'lastSeenAt' },
    { param: 'installedAt', field: 'installedAt' },
    { param: 'createdAt', field: 'createdAt' },
  ],
  defaultSort: { field: 'imei', direction: 'ASC' },
  filters: { conditions: codec },
};
export function deviceViewQuery(state: DeviceQueryState): ListQuery {
  return {
    search: state.search,
    conditions: state.filter.conditions ?? [],
    sort: { field: state.sort.field, direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}
export function deviceQueryState(query: ListQuery): DeviceQueryState {
  return {
    search: query.search,
    filter: { conditions: query.conditions },
    sort: {
      field:
        deviceDefinition.sorts.find((entry) => entry.field === query.sort?.field)?.field ?? 'imei',
      direction: query.sort?.direction === 'desc' ? 'DESC' : 'ASC',
    },
    page: query.page,
    pageSize: query.pageSize,
  };
}
function predicate({ field, operator, values }: FilterCondition): FleetDeviceCondition {
  switch (field) {
    case 'status': {
      const codes = deviceStatuses.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedStatuses: codes } : { statuses: codes };
    }
    case 'model': {
      const codes = deviceModels.filter((code) => values.includes(code));
      return operator === 'isNoneOf' ? { excludedModels: codes } : { models: codes };
    }
    case 'firmware':
      return operator === 'equals'
        ? { firmwareVersionEquals: values[0] }
        : operator === 'notEquals'
          ? { firmwareVersionNotEquals: values[0] }
          : { firmwareVersionStartsWith: values[0] };
    case 'installed':
      return { hasVehicle: operator === 'isTrue' };
    default:
      throw new Error('Unsupported Devices filter.');
  }
}
export function deviceVariables(state: DeviceQueryState): AdminDevicesQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    sort: { field: sorts[state.sort.field], direction: state.sort.direction },
    filter: state.filter.conditions?.length
      ? { allOf: state.filter.conditions.map(predicate) }
      : null,
  };
}
