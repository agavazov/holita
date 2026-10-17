import { BadRequestException } from '@nestjs/common';
import type { KarmaEdataInput } from '../../generated/graphql/types.js';

function invalid(): never {
  throw new BadRequestException('Invalid Karma eData filters or cursor');
}

function id(value: string): string {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) invalid();
  return value;
}

function date(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value.replace('Z', '.000Z'))
    invalid();
  return value;
}

export function edataQuery(input: KarmaEdataInput) {
  const carId = id(input.carId);
  const pageSize = input.pageSize ?? 50;
  if (![25, 50, 100].includes(pageSize)) invalid();
  const fromDate = date(input.fromDate);
  const toDate = date(input.toDate);
  if ((fromDate === null) !== (toDate === null) || (fromDate && toDate && fromDate > toDate))
    invalid();
  if ((input.parameterIds?.length ?? 0) > 25) invalid();
  const parameterIds = [...new Set((input.parameterIds ?? []).map(id))].sort(
    (a, b) => Number(a) - Number(b),
  );
  const scope = JSON.stringify([carId, pageSize, fromDate, toDate, parameterIds]);
  let before: number | null = null;
  let snapshot: number | null = null;
  if (input.cursor !== undefined && input.cursor !== null) {
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(input.cursor)) invalid();
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
    } catch {
      invalid();
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
    if (
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
  return { carId, pageSize, fromDate, toDate, parameterIds, scope, before, snapshot };
}

export type EdataQuery = ReturnType<typeof edataQuery>;

export function edataCursor(query: EdataQuery, before: number, snapshot: number): string {
  return Buffer.from(JSON.stringify({ version: 1, scope: query.scope, before, snapshot })).toString(
    'base64url',
  );
}

export function edataParameters(query: EdataQuery): URLSearchParams {
  const parameters = new URLSearchParams({ car: query.carId, date_type: 'utc', showdesc: '1' });
  if (query.before !== null) parameters.set('to_id', String(query.before));
  if (query.fromDate && query.toDate) {
    parameters.set('from_date', query.fromDate.replace('T', ' ').replace('Z', ''));
    parameters.set('to_date', query.toDate.replace('T', ' ').replace('Z', ''));
  }
  for (const parameter of query.parameterIds) parameters.append('parameter_id[]', parameter);
  return parameters;
}
