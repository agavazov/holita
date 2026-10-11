import type { ParamMap } from '@angular/router';
import type {
  AdminDevicesQueryVariables,
  FleetDeviceSortDirection,
  FleetDeviceSortField,
} from '../../../../generated/graphql/operations';

export interface DeviceListQuery {
  page: number;
  pageSize: number;
  search: string;
  sort: FleetDeviceSortField;
  order: FleetDeviceSortDirection;
}

export const devicePageSizes = [10, 20, 50, 100];
const sortFields = [{ param: 'imei', field: 'IMEI' }] satisfies {
  param: string;
  field: FleetDeviceSortField;
}[];

export function readDeviceListQuery(params: ParamMap): DeviceListQuery {
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = devicePageSizes.includes(requestedSize) ? requestedSize : 20;
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

export function deviceListQueryParams(query: DeviceListQuery) {
  return {
    page: query.page === 1 ? null : String(query.page),
    pageSize: query.pageSize === 20 ? null : String(query.pageSize),
    search: query.search || null,
    sort: sortFields.find((option) => option.field === query.sort)?.param ?? null,
    order: query.sort === 'CREATED_AT' ? null : query.order.toLowerCase(),
  };
}

export function deviceListVariables(query: DeviceListQuery): AdminDevicesQueryVariables {
  return {
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    sort: { field: query.sort, direction: query.order },
  };
}

export function sameDeviceListQuery(a: DeviceListQuery, b: DeviceListQuery): boolean {
  return (
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.sort === b.sort &&
    a.order === b.order
  );
}
