import type { ParamMap } from '@angular/router';
import type { KarmaEdataInput } from '../../../../generated/graphql/operations';

export function edataFilters(carId: string, params: ParamMap): KarmaEdataInput | null {
  if (['size', 'from', 'to', 'parameters', 'cursor'].some((key) => params.getAll(key).length > 1))
    return null;
  const pageSize = Number(params.get('size') ?? '50');
  if (![25, 50, 100].includes(pageSize)) return null;
  const fromDate = utcDate(params.get('from') ?? '');
  const toDate = utcDate(params.get('to') ?? '');
  if (
    fromDate === undefined ||
    toDate === undefined ||
    !!fromDate !== !!toDate ||
    (fromDate && toDate && fromDate > toDate)
  )
    return null;
  const rawIds = params.get('parameters') ?? '';
  const parameterIds = rawIds ? rawIds.split(',').map((value) => value.trim()) : [];
  if (parameterIds.length > 25 || parameterIds.some((value) => !positiveId(value))) return null;
  const cursor = params.get('cursor');
  if (cursor !== null && !/^[A-Za-z0-9_-]{1,2048}$/.test(cursor)) return null;
  return {
    carId,
    pageSize,
    fromDate,
    toDate,
    parameterIds: [...new Set(parameterIds)].sort((a, b) => Number(a) - Number(b)),
    cursor,
  };
}

export function positiveId(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function utcDate(value: string): string | null | undefined {
  if (!value) return null;
  const normalized = value.length === 16 ? value + ':00Z' : value + 'Z';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) return undefined;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === normalized.replace('Z', '.000Z')
    ? normalized
    : undefined;
}
