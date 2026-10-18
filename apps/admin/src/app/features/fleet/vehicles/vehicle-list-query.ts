import type { ParamMap } from '@angular/router';
import type {
  AdminVehiclesQueryVariables,
  FleetSortDirection,
  FleetVehicleSortField,
} from '../../../../generated/graphql/operations';

/** Sort fields this screen offers; the API supports more. */
type VehicleListSortField = Extract<FleetVehicleSortField, 'LICENSE_PLATE' | 'CREATED_AT'>;

export interface VehicleListQuery {
  page: number;
  pageSize: number;
  search: string;
  sort: VehicleListSortField;
  order: FleetSortDirection;
}

export const vehiclePageSizes = [10, 20, 50, 100];
const sortFields = [{ param: 'licensePlate', field: 'LICENSE_PLATE' }] satisfies {
  param: string;
  field: VehicleListSortField;
}[];

export function readVehicleListQuery(params: ParamMap): VehicleListQuery {
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = vehiclePageSizes.includes(requestedSize) ? requestedSize : 20;
  const requestedPage = Number(params.get('page'));
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
    sort: sort ?? 'CREATED_AT',
    order: sort ? (params.get('order') === 'desc' ? 'DESC' : 'ASC') : 'DESC',
  };
}

export function vehicleListQueryParams(query: VehicleListQuery) {
  return {
    page: query.page === 1 ? null : String(query.page),
    pageSize: query.pageSize === 20 ? null : String(query.pageSize),
    search: query.search || null,
    sort: sortFields.find((option) => option.field === query.sort)?.param ?? null,
    order: query.sort === 'CREATED_AT' ? null : query.order.toLowerCase(),
  };
}

export function vehicleListVariables(query: VehicleListQuery): AdminVehiclesQueryVariables {
  return {
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    sort: { field: query.sort, direction: query.order },
  };
}

export function sameVehicleListQuery(a: VehicleListQuery, b: VehicleListQuery): boolean {
  return (
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.sort === b.sort &&
    a.order === b.order
  );
}
