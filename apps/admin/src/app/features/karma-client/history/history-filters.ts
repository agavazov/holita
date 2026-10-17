import type { ParamMap } from '@angular/router';
import type {
  KarmaTripsInput,
  KarmaEventsInput,
  KarmaDrivingProfileInput,
} from '../../../../generated/graphql/operations';
export function historyDate(value: string, utc = false): string | null | undefined {
  if (!value) return null;
  const normalized = (value.length === 16 ? value + ':00' : value) + 'Z';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) return undefined;
  const parsed = new Date(normalized);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== normalized.replace('Z', '.000Z')
  )
    return undefined;
  return utc ? normalized : normalized.slice(0, -1);
}
function filters(carId: string, params: ParamMap, utc: boolean): KarmaTripsInput | null {
  if (['size', 'from', 'to', 'types', 'cursor'].some((key) => params.getAll(key).length > 1))
    return null;
  const pageSize = Number(params.get('size') ?? '50'),
    fromDate = historyDate(params.get('from') ?? '', utc),
    toDate = historyDate(params.get('to') ?? '', utc),
    cursor = params.get('cursor');
  if (
    ![25, 50, 100].includes(pageSize) ||
    fromDate === undefined ||
    toDate === undefined ||
    !!fromDate !== !!toDate ||
    (fromDate && toDate && fromDate > toDate) ||
    (cursor !== null && !/^[A-Za-z0-9_-]{1,2048}$/.test(cursor))
  )
    return null;
  return { carId, pageSize, fromDate, toDate, cursor };
}
export function tripsFilters(carId: string, params: ParamMap): KarmaTripsInput | null {
  return filters(carId, params, false);
}
export function eventsFilters(carId: string, params: ParamMap): KarmaEventsInput | null {
  const input = filters(carId, params, true),
    raw = params.get('types') ?? '',
    types = raw ? raw.split(',').map((value) => value.trim()) : [];
  if (
    !input ||
    types.length > 25 ||
    types.some((value) => !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)))
  )
    return null;
  return { ...input, eventTypes: [...new Set(types)].sort((a, b) => Number(a) - Number(b)) };
}
export function profileFilters(
  carId: string,
  params: ParamMap,
  defaults: { from: string; to: string },
): KarmaDrivingProfileInput | null {
  if (['from', 'to'].some((key) => params.getAll(key).length > 1)) return null;
  const fromDate = historyDate(params.get('from') ?? defaults.from),
    toDate = historyDate(params.get('to') ?? defaults.to);
  if (!fromDate || !toDate || fromDate > toDate) return null;
  return { carId, fromDate, toDate };
}
export function profilePeriod(now = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 19),
    to: now.toISOString().slice(0, 19),
  };
}
