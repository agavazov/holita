import { BadRequestException } from '@nestjs/common';
import type {
  KarmaTripsInput,
  KarmaEventsInput,
  KarmaDrivingProfileInput,
} from '../generated/graphql/types.js';

function invalid(): never {
  throw new BadRequestException('Invalid Karma history filters or cursor');
}
function identifier(value: string, minimum = 1): string {
  if (
    !/^(0|[1-9]\d*)$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < minimum
  )
    invalid();
  return value;
}
function date(value: string | null | undefined, utc: boolean): string | null {
  if (value === undefined || value === null) return null;
  const normalized = utc ? value : value + 'Z';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) invalid();
  const parsed = new Date(normalized);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== normalized.replace('Z', '.000Z')
  )
    invalid();
  return value;
}
export function historyQuery(input: KarmaTripsInput | KarmaEventsInput, kind: 'trips' | 'events') {
  const carId = identifier(input.carId),
    pageSize = input.pageSize ?? 50;
  if (![25, 50, 100].includes(pageSize)) invalid();
  const fromDate = date(input.fromDate, kind === 'events'),
    toDate = date(input.toDate, kind === 'events');
  if ((fromDate === null) !== (toDate === null) || (fromDate && toDate && fromDate > toDate))
    invalid();
  const types = 'eventTypes' in input ? (input.eventTypes ?? []) : [];
  if (types.length > 25) invalid();
  const eventTypes = [...new Set(types.map((value) => identifier(value, 0)))].sort(
    (a, b) => Number(a) - Number(b),
  );
  const scope = JSON.stringify([kind, carId, pageSize, fromDate, toDate, eventTypes]);
  let before: number | null = null,
    snapshot: number | null = null;
  if (input.cursor !== undefined && input.cursor !== null) {
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(input.cursor)) invalid();
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
    } catch {
      invalid();
    }
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      !('version' in value) ||
      value.version !== 1 ||
      !('scope' in value) ||
      value.scope !== scope ||
      !('before' in value) ||
      typeof value.before !== 'number' ||
      !Number.isSafeInteger(value.before) ||
      value.before < 1 ||
      !('snapshot' in value) ||
      typeof value.snapshot !== 'number' ||
      !Number.isSafeInteger(value.snapshot) ||
      value.snapshot < value.before
    )
      invalid();
    before = value.before;
    snapshot = value.snapshot;
  }
  return { kind, carId, pageSize, fromDate, toDate, eventTypes, scope, before, snapshot };
}
export type HistoryQuery = ReturnType<typeof historyQuery>;
export function historyCursor(query: HistoryQuery, before: number, snapshot: number): string {
  return Buffer.from(JSON.stringify({ version: 1, scope: query.scope, before, snapshot })).toString(
    'base64url',
  );
}
export function historyParameters(query: HistoryQuery): URLSearchParams {
  const params = new URLSearchParams({ car: query.carId });
  if (query.kind === 'events') {
    params.set('date_type', 'utc');
    for (const field of ['spd', 'odo', 'edt_tz', 'pdt']) params.append('fields[]', field);
  }
  if (query.before !== null) params.set('to_id', String(query.before));
  if (query.fromDate && query.toDate) {
    params.set('from_date', query.fromDate.replace('T', ' ').replace('Z', ''));
    params.set('to_date', query.toDate.replace('T', ' ').replace('Z', ''));
  }
  for (const code of query.eventTypes) params.append('event_type[]', code);
  return params;
}
export function profileParameters(input: KarmaDrivingProfileInput): URLSearchParams {
  const carId = identifier(input.carId),
    fromDate = date(input.fromDate, false),
    toDate = date(input.toDate, false);
  if (!fromDate || !toDate || fromDate > toDate) invalid();
  return new URLSearchParams({
    car: carId,
    from_date: fromDate.replace('T', ' '),
    to_date: toDate.replace('T', ' '),
  });
}
