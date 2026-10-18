import type { ParamMap, Params } from '@angular/router';

// The URL state standard shared by every list and tab (spec 3.4): typed, normalised and with
// defaults omitted from the URL.

export type SortDirection = 'ASC' | 'DESC';

export interface ListState<F, S extends string> {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly sort: { readonly field: S; readonly direction: SortDirection };
  /** Absent filters are `undefined`. */
  readonly filter: Partial<F>;
}

export interface FilterCodec<T> {
  read(values: readonly string[]): T | undefined;
  write(value: T | undefined): string | null;
  same(a: T | undefined, b: T | undefined): boolean;
}

export interface SortDefault<S extends string> {
  readonly field: S;
  readonly direction: SortDirection;
}

export interface ListDefinition<F, S extends string> {
  readonly pageSizes: readonly number[];
  readonly defaultPageSize: number;
  readonly sorts: readonly { readonly param: string; readonly field: S }[];
  readonly defaultSort: SortDefault<S>;
  /** Per-view defaults: when URL param `param` has one of the listed values, that entry replaces
   * `defaultSort` (Maintenance: `{ param: 'view', sorts: { completed: COMPLETED_ON DESC } }`). */
  readonly viewDefaultSorts?: {
    readonly param: string;
    readonly sorts: Readonly<Record<string, SortDefault<S>>>;
  };
  readonly filters: { readonly [K in keyof F]-?: FilterCodec<F[K]> };
  /** Pure cross-field rule applied after decoding and before writing. */
  readonly normalizeFilter?: (filter: Partial<F>) => Partial<F>;
}

export const maxSearchLength = 200;
export const maxSearchWords = 5;
const maxListValues = 100;
const maxInt32 = 2_147_483_647;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;

function sameList(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = new Set(a ?? []);
  const right = new Set(b ?? []);
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function listCodec<T extends string>(
  accept: (value: string) => T | undefined,
  max: number,
): FilterCodec<readonly T[]> {
  return {
    read(values) {
      const result: T[] = [];
      for (const value of values) {
        const accepted = accept(value.trim());
        if (accepted !== undefined && !result.includes(accepted)) result.push(accepted);
      }
      return result.length ? result.slice(0, max) : undefined;
    },
    write: (value) => (value?.length ? value.join(',') : null),
    same: sameList,
  };
}

function realDate(text: string): boolean {
  const match = dateOnly.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function decimals(step: number): number {
  const text = String(step);
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
}

export const codecs = {
  /** Comma-separated enum values; unknown values are dropped. */
  enumList<const T extends string>(values: readonly T[]): FilterCodec<readonly T[]> {
    return listCodec((value) => values.find((candidate) => candidate === value), maxListValues);
  },
  /** Comma-separated UUIDs (lower case), at most `max`. */
  idList(max: number): FilterCodec<readonly string[]> {
    return listCodec(
      (value) => (uuid.test(value) ? value.toLowerCase() : undefined),
      Math.min(max, maxListValues),
    );
  },
  boolean(): FilterCodec<boolean> {
    return {
      read: (values) => (values[0] === 'true' ? true : values[0] === 'false' ? false : undefined),
      write: (value) => (value === undefined ? null : String(value)),
      same: (a, b) => a === b,
    };
  },
  /** `YYYY-MM-DD` calendar dates. */
  dateOnly(): FilterCodec<string> {
    return {
      read: (values) => {
        const value = values[0]?.trim() ?? '';
        return realDate(value) ? value : undefined;
      },
      write: (value) => value ?? null,
      same: (a, b) => a === b,
    };
  },
  /** One of `values`; absent or unknown means `fallback`, which is never written. */
  choice<const T extends string>(values: readonly T[], fallback: NoInfer<T>): FilterCodec<T> {
    return {
      read: (input) => values.find((value) => value === input[0]) ?? fallback,
      write: (value) => (value === undefined || value === fallback ? null : value),
      same: (a, b) => (a ?? fallback) === (b ?? fallback),
    };
  },
  /** Integer in [min, max]; anything else is dropped. */
  integer(min: number, max: number): FilterCodec<number> {
    return {
      read: (values) => {
        const text = values[0]?.trim() ?? '';
        if (!/^-?\d+$/.test(text)) return undefined;
        const value = Number(text);
        return value >= min && value <= max ? value : undefined;
      },
      write: (value) => (value === undefined ? null : String(value)),
      same: (a, b) => a === b,
    };
  },
  /** Finite decimal in [min, max] rounded to `step`. */
  number(min: number, max: number, step: number): FilterCodec<number> {
    const places = decimals(step);
    return {
      read: (values) => {
        const text = values[0]?.trim() ?? '';
        if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
        const value = Number((Math.round(Number(text) / step) * step).toFixed(places));
        return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
      },
      write: (value) => (value === undefined ? null : String(value)),
      same: (a, b) => a === b,
    };
  },
};

/** Search text as tokens: trimmed and split on Unicode whitespace. */
export function searchTokens(search: string): readonly string[] {
  return search.trim().split(/\s+/u).filter(Boolean);
}

/** Whether a search text is applied (at most five words). */
export function searchApplies(search: string): boolean {
  return searchTokens(search).length <= maxSearchWords;
}

/** Trimmed search without NUL characters, at most 200 code points. */
export function normalizeSearch(search: string | null | undefined): string {
  return Array.from((search ?? '').replaceAll('\u0000', '').trim())
    .slice(0, maxSearchLength)
    .join('')
    .trim();
}

function effectiveDefaultSort<F, S extends string>(
  definition: ListDefinition<F, S>,
  view: string | null,
): SortDefault<S> {
  const views = definition.viewDefaultSorts;
  return (view !== null ? views?.sorts[view] : undefined) ?? definition.defaultSort;
}

/** The written URL value of one filter key, or `null`. */
function writtenFilter<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
  name: string,
): string | null {
  for (const key in definition.filters)
    if (key === name) return definition.filters[key].write(state.filter[key]);
  return null;
}

/** The default sort that applies to a state (its view may select a per-view default). */
export function defaultSortOf<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): SortDefault<S> {
  const param = definition.viewDefaultSorts?.param;
  return effectiveDefaultSort(definition, param ? writtenFilter(state, definition, param) : null);
}

/** Decodes and normalises a list's query parameters. */
export function readListState<F, S extends string>(
  params: ParamMap,
  definition: ListDefinition<F, S>,
): ListState<F, S> {
  const pageSize = definition.pageSizes.find((size) => String(size) === params.get('pageSize'));
  const size = pageSize ?? definition.defaultPageSize;
  const pageText = params.get('page') ?? '';
  const requestedPage = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  const page = Math.min(Math.max(requestedPage, 1), Math.floor(maxInt32 / size) + 1);
  const viewParam = definition.viewDefaultSorts?.param;
  const fallback = effectiveDefaultSort(definition, viewParam ? params.get(viewParam) : null);
  const sortParam = params.get('sort');
  const field = definition.sorts.find((sort) => sort.param === sortParam)?.field ?? fallback.field;
  const order = params.get('order');
  const direction: SortDirection =
    order === 'asc'
      ? 'ASC'
      : order === 'desc'
        ? 'DESC'
        : field === fallback.field
          ? fallback.direction
          : 'ASC';
  let filter: Partial<F> = {};
  for (const key in definition.filters) {
    const raw = params.get(key);
    const value = definition.filters[key].read(raw === null ? [] : raw.split(','));
    if (value !== undefined) filter[key] = value;
  }
  if (definition.normalizeFilter) filter = definition.normalizeFilter(filter);
  return {
    page,
    pageSize: size,
    search: normalizeSearch(params.get('search')),
    sort: { field, direction },
    filter,
  };
}

/** The query parameters of a state; defaults are `null` so they disappear from the URL. */
export function listStateParams<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): Params {
  const filter = definition.normalizeFilter
    ? definition.normalizeFilter(state.filter)
    : state.filter;
  const normalized = { ...state, filter };
  const fallback = defaultSortOf(normalized, definition);
  const { field, direction } = state.sort;
  const defaultDirection = field === fallback.field ? fallback.direction : 'ASC';
  const params: Params = {
    search: normalizeSearch(state.search) || null,
    sort:
      field === fallback.field
        ? null
        : (definition.sorts.find((sort) => sort.field === field)?.param ?? null),
    order: direction === defaultDirection ? null : direction.toLowerCase(),
    page: state.page > 1 ? String(state.page) : null,
    pageSize: state.pageSize === definition.defaultPageSize ? null : String(state.pageSize),
  };
  for (const key in definition.filters) params[key] = definition.filters[key].write(filter[key]);
  return params;
}

/** Equality under the definition's codecs. */
export function sameListState<F, S extends string>(
  a: ListState<F, S>,
  b: ListState<F, S>,
  definition: ListDefinition<F, S>,
): boolean {
  if (
    a.page !== b.page ||
    a.pageSize !== b.pageSize ||
    a.search !== b.search ||
    a.sort.field !== b.sort.field ||
    a.sort.direction !== b.sort.direction
  )
    return false;
  for (const key in definition.filters)
    if (!definition.filters[key].same(a.filter[key], b.filter[key])) return false;
  return true;
}

/** Applied filters (not search, not the per-view parameter) for the mobile "Filters (n)" toggle. */
export function activeFilterCount<F, S extends string>(
  state: ListState<F, S>,
  definition: ListDefinition<F, S>,
): number {
  let count = 0;
  for (const key in definition.filters)
    if (
      key !== definition.viewDefaultSorts?.param &&
      definition.filters[key].write(state.filter[key]) !== null
    )
      count++;
  return count;
}
