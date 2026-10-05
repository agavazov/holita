import type { CrudFilters } from '@refinedev/core';
import { dayjs, eventTimezone } from './event-time.js';
import type {
  ReferenceEventFormat,
  ReferenceEventStatus,
} from '../../../generated/graphql/operations.js';

export const eventStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] satisfies ReferenceEventStatus[];
export const eventFormats = ['IN_PERSON', 'ONLINE', 'HYBRID'] satisfies ReferenceEventFormat[];
export const eventSortFields = [
  'title',
  'startsAt',
  'status',
  'capacity',
  'budget',
  'createdAt',
] as const;
export type EventSortField = (typeof eventSortFields)[number];
export function isEventSortField(value: string): value is EventSortField {
  return eventSortFields.some((field) => field === value);
}
export type EventListState = {
  trashed: boolean;
  search: string;
  statuses: ReferenceEventStatus[];
  formats: ReferenceEventFormat[];
  venueIds: string[];
  tagIds: string[];
  featured: boolean | undefined;
  from: string;
  to: string;
  capacityMin: number | undefined;
  capacityMax: number | undefined;
  sort: EventSortField;
  order: 'asc' | 'desc';
  page: number;
  size: number;
};
const positiveInteger = (value: string | null) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 2147483647 ? number : undefined;
};
const date = (value: string | null) =>
  value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dayjs(value).isValid() &&
  dayjs(value).format('YYYY-MM-DD') === value
    ? value
    : '';
const ids = (value: string | null) =>
  [
    ...new Set(
      (value ?? '')
        .split(',')
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
    ),
  ].slice(0, 100);
export function readEventList(search: string): EventListState {
  const params = new URLSearchParams(search);
  const sort = params.get('sort') ?? 'startsAt';
  const size = positiveInteger(params.get('size')) ?? 20;
  const from = date(params.get('from')),
    to = date(params.get('to'));
  const minimum = positiveInteger(params.get('min')),
    maximum = positiveInteger(params.get('max'));
  return {
    trashed: params.get('view') === 'trash',
    search: (params.get('q') ?? '').slice(0, 200),
    statuses: eventStatuses.filter((value) => params.get('status')?.split(',').includes(value)),
    formats: eventFormats.filter((value) => params.get('format')?.split(',').includes(value)),
    venueIds: ids(params.get('venues')),
    tagIds: ids(params.get('tags')),
    featured:
      params.get('featured') === 'true'
        ? true
        : params.get('featured') === 'false'
          ? false
          : undefined,
    from,
    to: from && to && from > to ? from : to,
    capacityMin: minimum,
    capacityMax: maximum && (!minimum || maximum >= minimum) ? maximum : undefined,
    sort: isEventSortField(sort) ? sort : 'startsAt',
    order: params.get('order') === 'desc' ? 'desc' : 'asc',
    size: [10, 20, 50, 100].includes(size) ? size : 20,
    page: Math.min(positiveInteger(params.get('page')) ?? 1, 21474836),
  };
}
export function eventListSearch(state: EventListState): string {
  const params = new URLSearchParams();
  if (state.trashed) params.set('view', 'trash');
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.statuses.length) params.set('status', state.statuses.join(','));
  if (state.formats.length) params.set('format', state.formats.join(','));
  if (state.venueIds.length) params.set('venues', state.venueIds.join(','));
  if (state.tagIds.length) params.set('tags', state.tagIds.join(','));
  if (state.featured !== undefined) params.set('featured', String(state.featured));
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.capacityMin) params.set('min', String(state.capacityMin));
  if (state.capacityMax) params.set('max', String(state.capacityMax));
  if (state.sort !== 'startsAt') params.set('sort', state.sort);
  if (state.order !== 'asc') params.set('order', state.order);
  if (state.page !== 1) params.set('page', String(state.page));
  if (state.size !== 20) params.set('size', String(state.size));
  const search = params.toString();
  return search ? `?${search}` : '';
}
export function eventListFilters(state: EventListState): CrudFilters {
  const fields = {
    trashed: state.trashed ? true : undefined,
    search: state.search,
    statuses: state.statuses,
    formats: state.formats,
    venueIds: state.venueIds,
    tagIds: state.tagIds,
    featured: state.featured,
    startsAtFrom: state.from
      ? dayjs.tz(`${state.from} 00:00`, eventTimezone).toISOString()
      : undefined,
    // Add a calendar day before interpreting midnight in Sofia, including 23/25-hour days.
    startsAtBefore: state.to
      ? dayjs
          .tz(`${dayjs(state.to).add(1, 'day').format('YYYY-MM-DD')} 00:00`, eventTimezone)
          .toISOString()
      : undefined,
    capacityMin: state.capacityMin,
    capacityMax: state.capacityMax,
  };
  return Object.entries(fields)
    .filter(
      ([, value]) =>
        value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0),
    )
    .map(([field, value]) => ({ field, operator: 'eq', value }));
}
// Carry only the original list query. The destination path always comes from the active store.
export function eventListReturn(resource: string, search: string): string {
  return `/${resource}${eventListSearch(readEventList(new URLSearchParams(search).get('list') ?? ''))}`;
}
export function eventLink(resource: string, suffix: string, listSearch: string): string {
  return `/${resource}/${suffix}${listSearch ? `?${new URLSearchParams({ list: listSearch }).toString()}` : ''}`;
}
