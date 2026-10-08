import type { ParamMap } from '@angular/router';
import type {
  AdminVenuesQueryVariables,
  ReferenceVenueSortDirection,
  ReferenceVenueSortField,
} from '../../../../generated/graphql/operations';

export interface VenueListQuery {
  page: number;
  pageSize: number;
  search: string;
  active: boolean | null;
  sort: ReferenceVenueSortField;
  order: ReferenceVenueSortDirection;
}

export const venuePageSizes = [10, 20, 50, 100];
const sortFields = [
  { param: 'name', field: 'NAME' },
  { param: 'city', field: 'CITY' },
  { param: 'countryCode', field: 'COUNTRY_CODE' },
  { param: 'capacity', field: 'CAPACITY' },
  { param: 'active', field: 'ACTIVE' },
] satisfies { param: string; field: ReferenceVenueSortField }[];

export function readVenueListQuery(params: ParamMap): VenueListQuery {
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = venuePageSizes.includes(requestedSize) ? requestedSize : 20;
  const requestedPage = Number(params.get('page'));
  const active = params.get('active');
  const sort = sortFields.find((option) => option.param === params.get('sort'))?.field;
  return {
    page:
      Number.isInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, Math.floor(2147483647 / pageSize) + 1)
        : 1,
    pageSize,
    search: Array.from((params.get('search') ?? '').replaceAll('\u0000', '').trim())
      .slice(0, 200)
      .join(''),
    active: active === 'true' ? true : active === 'false' ? false : null,
    sort: sort ?? 'CREATED_AT',
    order: sort ? (params.get('order') === 'desc' ? 'DESC' : 'ASC') : 'DESC',
  };
}

export function venueListQueryParams(query: VenueListQuery) {
  return {
    page: query.page === 1 ? null : String(query.page),
    pageSize: query.pageSize === 20 ? null : String(query.pageSize),
    search: query.search || null,
    active: query.active === null ? null : String(query.active),
    sort: sortFields.find((option) => option.field === query.sort)?.param ?? null,
    order: query.sort === 'CREATED_AT' ? null : query.order.toLowerCase(),
  };
}

export function venueListVariables(query: VenueListQuery): AdminVenuesQueryVariables {
  return {
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.active !== null ? { active: query.active } : {}),
    sort: { field: query.sort, direction: query.order },
  };
}

export function sameVenueListQuery(a: VenueListQuery, b: VenueListQuery): boolean {
  return (
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.active === b.active &&
    a.sort === b.sort &&
    a.order === b.order
  );
}
