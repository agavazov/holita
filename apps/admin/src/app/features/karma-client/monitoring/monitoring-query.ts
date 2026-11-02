import type { FleetKarmaMonitoringEventKind } from '../../../../generated/graphql/operations';
import {
  codecs,
  type FilterCodec,
  type ListDefinition,
  type ListState,
} from '../../../ui/list/list-state';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { zonedWallTimeToIso } from '../../../ui/format/zoned-time';

export const eventKinds = [
  'CAME_ONLINE',
  'NO_DATA_SINCE',
  'FAULT_REPORTED',
  'FAULT_REPORT_UNDECODED',
  'FAULT_READ_REQUESTED',
  'FAULT_READ_ANSWERED',
  'FAULT_READ_FAILED',
  'POLL_FAILED',
] as const satisfies readonly FleetKarmaMonitoringEventKind[];
interface MonitoringFilters {
  online: boolean | undefined;
  withFaults: boolean | undefined;
  truck: string | undefined;
  kind: readonly FleetKarmaMonitoringEventKind[] | undefined;
  from: string | undefined;
  to: string | undefined;
}
const truckCodec: FilterCodec<string> = {
  read: (values) => (values[0] && /^[1-9]\d{0,31}$/.test(values[0]) ? values[0] : undefined),
  write: (value) => value ?? null,
  same: (a, b) => a === b,
};
export const monitoringDefinition: ListDefinition<MonitoringFilters, 'newest'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [{ param: 'newest', field: 'newest' }],
  defaultSort: { field: 'newest', direction: 'DESC' },
  filters: {
    online: codecs.boolean(),
    withFaults: codecs.boolean(),
    truck: truckCodec,
    kind: codecs.enumList(eventKinds),
    from: codecs.dateOnly(),
    to: codecs.dateOnly(),
  },
  normalizeFilter: (filter) =>
    filter.from && filter.to && filter.from > filter.to ? { ...filter, to: filter.from } : filter,
};
export type MonitoringState = ListState<MonitoringFilters, 'newest'>;
export function monitoringConditions(state: MonitoringState, trucks: boolean): FilterCondition[] {
  const f = state.filter;
  const result: FilterCondition[] = [];
  if (trucks) {
    for (const field of ['online', 'withFaults'] as const) {
      if (f[field] !== undefined) {
        result.push({ id: field, field, operator: f[field] ? 'isTrue' : 'isFalse', values: [] });
      }
    }
  } else {
    if (f.truck) {
      result.push({ id: 'truck', field: 'truck', operator: 'equals', values: [f.truck] });
    }
    if (f.kind?.length) {
      result.push({ id: 'kind', field: 'kind', operator: 'isAnyOf', values: f.kind });
    }
    for (const field of ['from', 'to'] as const) {
      if (f[field]) {
        result.push({ id: field, field, operator: 'on', values: [f[field]] });
      }
    }
  }
  return result;
}
export function monitoringFilter(
  conditions: readonly FilterCondition[],
): Partial<MonitoringFilters> {
  const find = (field: string) => conditions.find((item) => item.field === field);
  const online = find('online');
  const faults = find('withFaults');
  return {
    online: online ? online.operator === 'isTrue' : undefined,
    withFaults: faults ? faults.operator === 'isTrue' : undefined,
    truck: find('truck')?.values[0],
    kind: eventKinds.filter((kind) => find('kind')?.values.includes(kind)),
    from: find('from')?.values[0],
    to: find('to')?.values[0],
  };
}
export function dayBoundary(
  day: string | undefined,
  zone: string,
  end = false,
): string | undefined {
  if (!day) {
    return undefined;
  }
  const date = new Date(`${day}T00:00:00Z`);
  if (end) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const start = zonedWallTimeToIso(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    zone,
  );
  return end ? new Date(Date.parse(start) - 1).toISOString() : start;
}
