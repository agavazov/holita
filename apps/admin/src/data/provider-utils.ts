import type { CrudFilters } from '@refinedev/core';
import type { OperationResult } from '@urql/core';
import { DataError } from './data-error.js';
export function requireData<T>(response: OperationResult<T>): T {
  if (!response.data) throw new DataError('The gateway returned no data.');
  return response.data;
}
export function lookupFilters(filters?: CrudFilters) {
  let search: string | undefined, active: boolean | undefined, ids: string[] | undefined;
  for (const filter of filters ?? []) {
    if (!('field' in filter)) continue;
    const value: unknown = filter.value;
    if (filter.field === 'search' && typeof value === 'string') search = value;
    if (filter.field === 'active' && typeof value === 'boolean') active = value;
    if (
      filter.field === 'ids' &&
      Array.isArray(value) &&
      value.every((id: unknown) => typeof id === 'string')
    )
      ids = value;
  }
  return {
    ...(search ? { search } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(ids ? { ids } : {}),
  };
}
