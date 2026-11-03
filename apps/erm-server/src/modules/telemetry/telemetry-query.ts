import { BadRequestException } from '@nestjs/common';
import type { ErmDevicePageInput, ErmEventCategory } from '../../generated/graphql/types.js';

function invalid(): never {
  throw new BadRequestException('Invalid ERM unit, page size or cursor');
}

export function telemetryQuery(
  kind: 'events' | 'frames' | 'commands' | 'parameterSnapshots',
  input: ErmDevicePageInput & { unitId: string },
  categories?: readonly ErmEventCategory[] | null,
) {
  const pageSize = input.pageSize ?? 50;
  const unitId = input.unitId;
  if (![25, 50, 100].includes(pageSize) || !/^(?:[0-9A-Fa-f]{6}|\d{15})$/.test(unitId)) {
    invalid();
  }
  const scope = JSON.stringify([
    kind,
    unitId,
    pageSize,
    ...(categories ? [[...new Set(categories)].sort()] : []),
  ]);
  let offset = 0;
  let snapshot = new Date();
  const cursor = input.cursor ?? null;
  if (cursor !== null) {
    if (!/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) {
      invalid();
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      invalid();
    }
    if (
      typeof value !== 'object' ||
      value === null ||
      !('scope' in value) ||
      value.scope !== scope ||
      !('offset' in value) ||
      typeof value.offset !== 'number' ||
      !Number.isSafeInteger(value.offset) ||
      value.offset < 0 ||
      !('snapshot' in value) ||
      typeof value.snapshot !== 'string'
    ) {
      invalid();
    }
    offset = value.offset;
    snapshot = new Date(value.snapshot);
    if (!Number.isFinite(snapshot.getTime()) || snapshot.toISOString() !== value.snapshot) {
      invalid();
    }
  }
  return { unitId, pageSize, scope, offset, snapshot, cursor };
}
export type TelemetryQuery = ReturnType<typeof telemetryQuery>;

export function deviceTelemetryQueries(
  kind: 'events' | 'frames' | 'commands' | 'parameterSnapshots',
  unitIds: string[],
  input: ErmDevicePageInput | null | undefined,
  categories?: readonly ErmEventCategory[] | null,
): TelemetryQuery[] {
  return unitIds.flatMap((unitId) => {
    try {
      return [telemetryQuery(kind, { ...input, unitId }, categories)];
    } catch (error) {
      if (error instanceof BadRequestException) {
        return [];
      }
      throw error;
    }
  });
}

export function telemetryPage<T>(rows: T[], query: TelemetryQuery) {
  const hasMore = rows.length > query.pageSize;
  return {
    items: rows.slice(0, query.pageSize),
    cursor: query.cursor,
    nextCursor: hasMore
      ? Buffer.from(
          JSON.stringify({
            scope: query.scope,
            offset: query.offset + query.pageSize,
            snapshot: query.snapshot.toISOString(),
          }),
        ).toString('base64url')
      : null,
    hasMore,
  };
}
