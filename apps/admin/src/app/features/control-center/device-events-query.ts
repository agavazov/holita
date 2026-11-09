import type {
  ErmEventCategory,
  ErmEventSeverity,
  ErmEventSortField,
} from '../../../generated/graphql/operations';
import { codecs, type ListDefinition } from '../../ui/list/list-state';

export const eventCategories: readonly ErmEventCategory[] = [
  'POSITION',
  'STATUS',
  'ALARM',
  'EDATA',
  'OTHER',
];
export const eventStatuses: readonly ErmEventSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
interface EventFilters {
  readonly statuses: readonly ErmEventSeverity[];
  readonly category: ErmEventCategory | '';
}
export const eventDefinition: ListDefinition<EventFilters, ErmEventSortField> = {
  pageSizes: [50],
  defaultPageSize: 50,
  sorts: [
    { param: 'time', field: 'TIME' },
    { param: 'event', field: 'EVENT_TYPE' },
    { param: 'status', field: 'STATUS' },
  ],
  defaultSort: { field: 'TIME', direction: 'DESC' },
  filters: {
    statuses: codecs.enumList(eventStatuses),
    category: codecs.choice([...eventCategories, ''], ''),
  },
};
