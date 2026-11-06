import type {
  AdminNotificationsQueryVariables,
  FleetNotificationCategory,
  FleetNotificationReadState,
} from '../../../generated/graphql/operations';
import type { FilterCondition } from '../../ui/filter-builder/filter-model';
import type { ListQuery } from '../../ui/list/list-query';
import { codecs, type ListDefinition, type ListState } from '../../ui/list/list-state';

interface NotificationFilters {
  readonly readState: FleetNotificationReadState;
  readonly category: FleetNotificationCategory | 'ALL';
}
type NotificationState = ListState<NotificationFilters, 'occurredAt'>;
const categories: readonly FleetNotificationCategory[] = ['ALERT', 'DEVICE', 'COMMAND'];

export const notificationDefinition: ListDefinition<NotificationFilters, 'occurredAt'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [{ param: 'occurredAt', field: 'occurredAt' }],
  defaultSort: { field: 'occurredAt', direction: 'DESC' },
  filters: {
    readState: codecs.choice(['ALL', 'UNREAD'], 'ALL'),
    category: codecs.choice(['ALL', ...categories], 'ALL'),
  },
};

export function notificationViewQuery(state: NotificationState): ListQuery {
  const conditions: FilterCondition[] = [];
  if (state.filter.readState === 'UNREAD') {
    conditions.push({
      id: 'readState',
      field: 'readState',
      operator: 'isAnyOf',
      values: ['UNREAD'],
    });
  }
  if (state.filter.category && state.filter.category !== 'ALL') {
    conditions.push({
      id: 'category',
      field: 'category',
      operator: 'isAnyOf',
      values: [state.filter.category],
    });
  }
  return {
    search: state.search,
    conditions,
    sort: { field: 'occurredAt', direction: state.sort.direction === 'ASC' ? 'asc' : 'desc' },
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function notificationQueryState(query: ListQuery): NotificationState {
  const category =
    query.conditions.find((condition) => condition.field === 'category')?.values ?? [];
  return {
    search: query.search,
    filter: {
      readState: query.conditions.some(
        (condition) => condition.field === 'readState' && condition.values.includes('UNREAD'),
      )
        ? 'UNREAD'
        : 'ALL',
      category: categories.find((value) => category.includes(value)) ?? 'ALL',
    },
    sort: { field: 'occurredAt', direction: query.sort?.direction === 'asc' ? 'ASC' : 'DESC' },
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function notificationVariables(state: NotificationState): AdminNotificationsQueryVariables {
  return {
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    search: state.search || null,
    filter: {
      readState: state.filter.readState ?? 'ALL',
      categories:
        state.filter.category && state.filter.category !== 'ALL' ? [state.filter.category] : null,
    },
    sort: { field: 'OCCURRED_AT', direction: state.sort.direction },
  };
}
