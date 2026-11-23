import type { ParamMap, Params } from '@angular/router';
import type { CatalogueQueryVariables, CatalogueSort } from './generated/operations';

export const browseSections = ['categories', 'brands', 'collections', 'tags'] as const;
export type BrowseSection = (typeof browseSections)[number];
export const cataloguePageSize = 20;
export const newestCatalogueSort = 'newest';
const maxPage = Math.floor(2_147_483_647 / cataloguePageSize) + 1;

export const sortChoices = [
  { value: '', label: 'sortDefault', sort: null },
  { value: 'name-asc', label: 'sortNameAsc', sort: 'NAME_ASC' },
  { value: 'name-desc', label: 'sortNameDesc', sort: 'NAME_DESC' },
  { value: 'price-asc', label: 'sortPriceAsc', sort: 'PRICE_ASC' },
  { value: 'price-desc', label: 'sortPriceDesc', sort: 'PRICE_DESC' },
  { value: newestCatalogueSort, label: 'sortNewest', sort: 'NEWEST' },
] as const satisfies readonly { value: string; label: string; sort: CatalogueSort | null }[];

export interface CatalogueFilters {
  q: string;
  minPrice: string;
  maxPrice: string;
  brand: string[];
  option: string[];
  inStock: boolean;
  sort: string;
}

export function emptyFilters(): CatalogueFilters {
  return { q: '', minPrice: '', maxPrice: '', brand: [], option: [], inStock: false, sort: '' };
}

function canonicalIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))].sort();
}

export function parseCatalogueUrl(params: ParamMap) {
  const rawPage = params.get('page') ?? '1';
  const page = /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const stock = params.get('inStock');
  const filters: CatalogueFilters = {
    q: params.get('q')?.trim() ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    brand: canonicalIds(params.getAll('brand')),
    option: canonicalIds(params.getAll('option')),
    inStock: stock === '1',
    sort: params.get('sort') ?? '',
  };
  return {
    filters,
    page: page <= maxPage ? page : 1,
    valid:
      /^[1-9]\d*$/.test(rawPage) &&
      page <= maxPage &&
      validCatalogueFilters(filters) &&
      (stock === null || stock === '1'),
  };
}

export function validCatalogueFilters(filters: CatalogueFilters): boolean {
  const query = filters.q.trim();
  const price = /^\d{1,10}(?:\.\d{1,2})?$/;
  const id = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
  return (
    Array.from(query).length <= 200 &&
    !query.includes('\u0000') &&
    [filters.minPrice, filters.maxPrice].every((value) => !value || price.test(value)) &&
    (!filters.minPrice ||
      !filters.maxPrice ||
      Number(filters.minPrice) <= Number(filters.maxPrice)) &&
    [...filters.brand, ...filters.option].every((value) => id.test(value)) &&
    sortChoices.some(({ value }) => value === filters.sort)
  );
}

export function hasFilters({ q, minPrice, maxPrice, brand, option, inStock }: CatalogueFilters) {
  return Boolean(q || minPrice || maxPrice || brand.length || option.length || inStock);
}

export function catalogueParams(filters: CatalogueFilters, page: number): Params {
  return {
    q: filters.q.trim() || null,
    sort: filters.sort || null,
    minPrice: filters.minPrice || null,
    maxPrice: filters.maxPrice || null,
    brand: filters.brand.length ? canonicalIds(filters.brand) : null,
    option: filters.option.length ? canonicalIds(filters.option) : null,
    inStock: filters.inStock ? '1' : null,
    page: page > 1 ? page : null,
  };
}

export function catalogueVariables(
  filters: CatalogueFilters,
  page: number,
): CatalogueQueryVariables {
  return {
    offset: (page - 1) * cataloguePageSize,
    limit: cataloguePageSize,
    filter: hasFilters(filters)
      ? {
          search: filters.q || null,
          minPrice: filters.minPrice || null,
          maxPrice: filters.maxPrice || null,
          brandIds: filters.brand,
          optionValueIds: filters.option,
          inStock: filters.inStock,
        }
      : null,
    sort: sortChoices.find(({ value }) => value === filters.sort)?.sort ?? null,
  };
}
