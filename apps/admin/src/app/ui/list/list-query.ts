import { afterNextRender } from '@angular/core';
import type { TableLazyLoadEvent } from 'primeng/table';
import type { FilterCondition } from '../filter-builder/filter-model';

/**
 * Whether a list view may take `p-table` sort events yet. PrimeNG 22 applies `sortField` before
 * `sortOrder` while rendering the first time and reports a sort in between (a descending default
 * arrives as ascending); nobody can click a header before the first render, so views ignore sort
 * events until then. Call it in an injection context.
 */
export function injectSortReady(): () => boolean {
  let ready = false;
  afterNextRender(() => {
    ready = true;
  });
  return () => ready;
}

/**
 * What a FilterBuilder list asks its backend for: quick search, AND-ed filter conditions, one sort
 * and a page. Views emit a new query; hosts map it to their API variables.
 */
export interface ListQuery {
  readonly search: string;
  readonly conditions: readonly FilterCondition[];
  readonly sort: { readonly field: string; readonly direction: 'asc' | 'desc' } | null;
  readonly page: number;
  readonly pageSize: number;
}

/** Any change except paging returns to the first page. */
export const listQuery = {
  search: (query: ListQuery, search: string): ListQuery => ({ ...query, search, page: 1 }),
  conditions: (query: ListQuery, conditions: readonly FilterCondition[]): ListQuery => ({
    ...query,
    conditions,
    page: 1,
  }),
  page: (query: ListQuery, page: { page: number; pageSize: number }): ListQuery => ({
    ...query,
    ...page,
  }),
  cleared: (query: ListQuery): ListQuery => ({ ...query, search: '', conditions: [], page: 1 }),
  /** The query after a `p-table` sort event, or null when the sort did not change. */
  sorted: (query: ListQuery, event: TableLazyLoadEvent): ListQuery | null => {
    const field = typeof event.sortField === 'string' ? event.sortField : null;
    if (!field) {
      return null;
    }
    const direction = event.sortOrder === 1 ? 'asc' : 'desc';
    if (query.sort?.field === field && query.sort.direction === direction) {
      return null;
    }
    return { ...query, sort: { field, direction }, page: 1 };
  },
  filtered: (query: ListQuery): boolean =>
    query.search.trim() !== '' || query.conditions.length > 0,
};
