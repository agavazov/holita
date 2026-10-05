import type { ParamMap } from '@angular/router';
import type {
  AdminProductsQueryVariables,
  ProductSortDirection,
  ProductSortField,
  ProductStatus,
} from '../../../generated/graphql/operations';

export interface ProductListQuery {
  page: number;
  pageSize: number;
  search: string;
  sku: string;
  status: ProductStatus | null;
  sort: ProductSortField;
  order: ProductSortDirection;
}

export const productPageSizes = [10, 20, 50, 100];

function text(value: string | null, max: number): string {
  return Array.from((value ?? '').replaceAll('\u0000', '').trim())
    .slice(0, max)
    .join('');
}

export function readProductListQuery(params: ParamMap): ProductListQuery {
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = productPageSizes.includes(requestedSize) ? requestedSize : 20;
  const requestedPage = Number(params.get('page'));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, Math.floor(2147483647 / pageSize) + 1)
      : 1;
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    page,
    pageSize,
    search: text(params.get('search'), 200),
    sku: text(params.get('sku'), 100),
    status: status === 'ACTIVE' || status === 'DRAFT' ? status : null,
    sort:
      sort === 'name'
        ? 'NAME'
        : sort === 'sku'
          ? 'SKU'
          : sort === 'status'
            ? 'STATUS'
            : 'CREATED_AT',
    order:
      sort === 'name' || sort === 'sku' || sort === 'status'
        ? params.get('order') === 'desc'
          ? 'DESC'
          : 'ASC'
        : 'DESC',
  };
}

export function productListQueryParams(query: ProductListQuery) {
  return {
    page: query.page === 1 ? null : String(query.page),
    pageSize: query.pageSize === 20 ? null : String(query.pageSize),
    search: query.search || null,
    sku: query.sku || null,
    status: query.status,
    sort: query.sort === 'CREATED_AT' ? null : query.sort.toLowerCase(),
    order: query.sort === 'CREATED_AT' ? null : query.order.toLowerCase(),
  };
}

export function productListVariables(query: ProductListQuery): AdminProductsQueryVariables {
  return {
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.sku ? { sku: query.sku } : {}),
    ...(query.status ? { status: query.status } : {}),
    sort: { field: query.sort, direction: query.order },
  };
}

export function sameProductListQuery(a: ProductListQuery, b: ProductListQuery): boolean {
  return (
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.search === b.search &&
    a.sku === b.sku &&
    a.status === b.status &&
    a.sort === b.sort &&
    a.order === b.order
  );
}
