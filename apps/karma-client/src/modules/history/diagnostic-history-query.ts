import { BadRequestException } from '@nestjs/common';
import type { KarmaDiagnosticHistoryInput } from '../../generated/graphql/types.js';

export const diagnosticHistoryLimits = { maxRows: 500, deadlineMs: 4000 };

function invalid(): never {
  throw new BadRequestException('Invalid Karma diagnostic history filters or cursor');
}

function identifier(value: string): number {
  const number = Number(value);
  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(number) ||
    number >= Number.MAX_SAFE_INTEGER
  ) {
    invalid();
  }
  return number;
}

export function diagnosticHistoryQuery(input: KarmaDiagnosticHistoryInput) {
  identifier(input.carId);
  const pageSize = input.pageSize ?? 50;
  if (![25, 50, 100].includes(pageSize)) {
    invalid();
  }
  const from =
    input.fromMessageId === undefined || input.fromMessageId === null
      ? 1
      : identifier(input.fromMessageId);
  const to =
    input.toMessageId === undefined || input.toMessageId === null
      ? null
      : identifier(input.toMessageId);
  if (to !== null && from > to) {
    invalid();
  }
  const scope = JSON.stringify([input.carId, pageSize, from, to]);
  let before = to;
  if (input.cursor !== undefined && input.cursor !== null) {
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(input.cursor)) {
      invalid();
    }
    let cursor: unknown;
    try {
      cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
    } catch {
      invalid();
    }
    if (
      typeof cursor !== 'object' ||
      cursor === null ||
      !('scope' in cursor) ||
      cursor.scope !== scope ||
      !('before' in cursor) ||
      typeof cursor.before !== 'number' ||
      !Number.isSafeInteger(cursor.before) ||
      cursor.before >= Number.MAX_SAFE_INTEGER ||
      cursor.before < from ||
      (to !== null && cursor.before > to)
    ) {
      invalid();
    }
    before = cursor.before;
  }
  return { carId: input.carId, pageSize, from, before, scope };
}

export type DiagnosticHistoryQuery = ReturnType<typeof diagnosticHistoryQuery>;

export function diagnosticHistoryCursor(query: DiagnosticHistoryQuery, before: number) {
  return Buffer.from(JSON.stringify({ scope: query.scope, before })).toString('base64url');
}

export function diagnosticHistoryParameters(query: DiagnosticHistoryQuery) {
  const parameters = new URLSearchParams({ car: query.carId, date_type: 'utc' });
  // Preserve either observed boundary convention, then select the public window locally.
  parameters.set('from_id', String(query.from - 1));
  if (query.before !== null) {
    parameters.set('to_id', String(query.before + 1));
  }
  for (const type of ['2', '33', '70']) {
    parameters.append('event_type[]', type);
  }
  for (const field of ['edt_tz', 'pdt']) {
    parameters.append('fields[]', field);
  }
  return parameters;
}
