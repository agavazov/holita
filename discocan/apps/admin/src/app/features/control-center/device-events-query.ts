import type {
  FleetDeviceEventCategory,
  FleetEventSeverity,
  FleetDeviceEventSortField,
} from '../../../generated/graphql/operations';
import { codecs, type ListDefinition } from '@osnova/ui';

export const eventCategories: readonly FleetDeviceEventCategory[] = [
  'POSITION',
  'STATUS',
  'ALARM',
  'DIAGNOSTIC',
  'OTHER',
];
const eventCategory = codecs.choice([...eventCategories, 'EDATA', ''] as const, '');
export const eventStatuses: readonly FleetEventSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
interface EventFilters {
  readonly statuses: readonly FleetEventSeverity[];
  readonly category: FleetDeviceEventCategory | '';
}
export const eventDefinition: ListDefinition<EventFilters, FleetDeviceEventSortField> = {
  pageSizes: [25, 50, 100],
  defaultPageSize: 50,
  sorts: [
    { param: 'time', field: 'TIME' },
    { param: 'event', field: 'CODE' },
    { param: 'status', field: 'SEVERITY' },
  ],
  defaultSort: { field: 'TIME', direction: 'DESC' },
  filters: {
    statuses: codecs.enumList(eventStatuses),
    category: {
      read(values) {
        const value = eventCategory.read(values);
        return value === 'EDATA' ? 'DIAGNOSTIC' : value;
      },
      write: (value) => eventCategory.write(value === 'DIAGNOSTIC' ? 'EDATA' : value),
      same: (left, right) => eventCategory.same(left, right),
    },
  },
};
/** Frames and parameter snapshots page like events and sort by time only. */
export const frameDefinition: ListDefinition<Record<string, never>, 'TIME'> = {
  pageSizes: [25, 50, 100],
  defaultPageSize: 50,
  sorts: [{ param: 'time', field: 'TIME' }],
  defaultSort: { field: 'TIME', direction: 'DESC' },
  filters: {},
};
export const snapshotDefinition: ListDefinition<Record<string, never>, 'TIME'> = {
  ...frameDefinition,
  defaultPageSize: 25,
};
