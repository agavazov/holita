import type { ParamMap } from '@angular/router';
import type {
  AdminEventsQueryVariables,
  ReferenceEventSortField,
  ReferenceEventSortDirection,
  ReferenceEventStatus,
  ReferenceEventFormat,
} from '../../../../generated/graphql/operations';
import { dayjs, eventTimezone, validCalendarDate } from './event-time';
import { eventStatuses, eventFormats } from './event-form';
export const eventPageSizes = [10, 20, 50, 100];
export const eventSortFields = [
  'TITLE',
  'STARTS_AT',
  'STATUS',
  'CAPACITY',
  'BUDGET',
  'CREATED_AT',
] satisfies ReferenceEventSortField[];
export interface EventListQuery {
  trashed: boolean;
  search: string;
  statuses: ReferenceEventStatus[];
  formats: ReferenceEventFormat[];
  venueIds: string[];
  tagIds: string[];
  featured: boolean | null;
  from: string;
  to: string;
  capacityMin: string;
  capacityMax: string;
  sort: ReferenceEventSortField;
  order: ReferenceEventSortDirection;
  page: number;
  pageSize: number;
}
export function validCapacity(value: string): boolean {
  return value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 2147483647);
}
function ids(value: string | null): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        .map((id) => id.toLowerCase()),
    ),
  ].slice(0, 100);
}
export function readEventListQuery(params: ParamMap): EventListQuery {
  const size = Number(params.get('pageSize'));
  const pageSize = eventPageSizes.includes(size) ? size : 20;
  const page = Number(params.get('page'));
  const from = params.get('from') ?? '',
    to = params.get('to') ?? '';
  const min = params.get('min') ?? '',
    max = params.get('max') ?? '';
  const capacityMin = validCapacity(min) ? min : '';
  const sort =
    eventSortFields.find((value) => value.toLowerCase() === params.get('sort')) ?? 'STARTS_AT';
  return {
    trashed: params.get('view') === 'trash',
    search: Array.from((params.get('search') ?? '').replaceAll('\0', '').trim())
      .slice(0, 200)
      .join(''),
    statuses: eventStatuses.filter((value) => params.get('status')?.split(',').includes(value)),
    formats: eventFormats.filter((value) => params.get('format')?.split(',').includes(value)),
    venueIds: ids(params.get('venues')),
    tagIds: ids(params.get('tags')),
    featured:
      params.get('featured') === 'true' ? true : params.get('featured') === 'false' ? false : null,
    from: validCalendarDate(from) ? from : '',
    to: validCalendarDate(to) && (!validCalendarDate(from) || to >= from) ? to : '',
    capacityMin,
    capacityMax:
      validCapacity(max) && (!capacityMin || !max || Number(max) >= Number(capacityMin)) ? max : '',
    sort,
    order: params.get('order') === 'desc' ? 'DESC' : 'ASC',
    pageSize,
    page:
      Number.isInteger(page) && page > 0
        ? Math.min(page, Math.floor(2147483647 / pageSize) + 1)
        : 1,
  };
}
export function eventListQueryParams(query: EventListQuery) {
  return {
    view: query.trashed ? 'trash' : null,
    search: query.search || null,
    status: query.statuses.join(',') || null,
    format: query.formats.join(',') || null,
    venues: query.venueIds.join(',') || null,
    tags: query.tagIds.join(',') || null,
    featured: query.featured === null ? null : String(query.featured),
    from: query.from || null,
    to: query.to || null,
    min: query.capacityMin || null,
    max: query.capacityMax || null,
    sort: query.sort === 'STARTS_AT' ? null : query.sort.toLowerCase(),
    order: query.order === 'ASC' ? null : 'desc',
    page: query.page === 1 ? null : String(query.page),
    pageSize: query.pageSize === 20 ? null : String(query.pageSize),
  };
}
export function eventListVariables(query: EventListQuery): AdminEventsQueryVariables {
  return {
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
    sort: { field: query.sort, direction: query.order },
    filter: {
      ...(query.trashed ? { trashed: true } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.statuses.length ? { statuses: query.statuses } : {}),
      ...(query.formats.length ? { formats: query.formats } : {}),
      ...(query.venueIds.length ? { venueIds: query.venueIds } : {}),
      ...(query.tagIds.length ? { tagIds: query.tagIds } : {}),
      ...(query.featured !== null ? { featured: query.featured } : {}),
      ...(query.from
        ? { startsAtFrom: dayjs.tz(`${query.from} 00:00`, eventTimezone).toISOString() }
        : {}),
      // Add a calendar day before resolving Sofia midnight; DST days contain 23 or 25 hours.
      ...(query.to
        ? {
            startsAtBefore: dayjs
              .tz(`${dayjs.utc(query.to).add(1, 'day').format('YYYY-MM-DD')} 00:00`, eventTimezone)
              .toISOString(),
          }
        : {}),
      ...(query.capacityMin ? { capacityMin: Number(query.capacityMin) } : {}),
      ...(query.capacityMax ? { capacityMax: Number(query.capacityMax) } : {}),
    },
  };
}
export function sameEventListQuery(a: EventListQuery, b: EventListQuery): boolean {
  return JSON.stringify(eventListQueryParams(a)) === JSON.stringify(eventListQueryParams(b));
}
export const eventColumns = [
  'code',
  'status',
  'format',
  'startsAt',
  'capacity',
  'budget',
  'createdAt',
] as const;
export type EventColumn = (typeof eventColumns)[number];
export const defaultEventColumns: EventColumn[] = [
  'code',
  'status',
  'format',
  'startsAt',
  'capacity',
];
export function readEventColumns(value: string | null): EventColumn[] {
  if (value === null) return [...defaultEventColumns];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? eventColumns.filter((column) => parsed.includes(column))
      : [...defaultEventColumns];
  } catch {
    return [...defaultEventColumns];
  }
}
