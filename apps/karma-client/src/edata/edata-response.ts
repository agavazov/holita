import { ServiceUnavailableException } from '@nestjs/common';
import type {
  KarmaEdataMessage,
  KarmaEdataPage,
  KarmaEdataParameter,
} from '../generated/graphql/types.js';
import { edataCursor, type EdataQuery } from './edata-query.js';

function unavailable(): never {
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) unavailable();
  return String(value);
}

function text(value: unknown, required = false): string | null {
  if (typeof value === 'string') return value;
  if (!required && (value === null || value === undefined)) return null;
  return unavailable();
}

function number(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) unavailable();
  return value;
}

function timestamp(value: unknown): string | null {
  const result = text(value);
  if (result !== null && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result)) unavailable();
  return result;
}

function parameter(value: unknown): KarmaEdataParameter {
  const row = value;
  if (!object(row)) unavailable();
  return { id: identifier(row['id']), value: number(row['value']), description: text(row['desc']) };
}

function message(value: unknown): KarmaEdataMessage {
  const row = value;
  if (!object(row)) unavailable();
  const deviceId = text(row['device_id'], true);
  const carNumber = text(row['carnumber'], true);
  const parameters: unknown = row['parameters'];
  if (deviceId === null || carNumber === null || !Array.isArray(parameters)) unavailable();
  const readings = parameters.map((entry: unknown) => parameter(entry));
  if (new Set(readings.map((entry) => entry.id)).size !== readings.length) unavailable();
  const latitude = number(row['latitude']);
  const longitude = number(row['longitude']);
  if (latitude !== null && Math.abs(latitude) > 90) unavailable();
  if (longitude !== null && Math.abs(longitude) > 180) unavailable();
  return {
    id: identifier(row['message_id']),
    carId: identifier(row['car_id']),
    deviceId,
    carNumber,
    eventTimeUtc: timestamp(row['edt']),
    eventTimeLocal: timestamp(row['edt_tz']),
    pdt: timestamp(row['pdt']),
    spd: number(row['spd']),
    odo: number(row['odo']),
    latitude,
    longitude,
    parameters: readings,
  };
}

export function edataPage(value: unknown, query: EdataQuery): KarmaEdataPage {
  if (!Array.isArray(value) || value.length > 500) unavailable();
  const rows = value.map((entry: unknown) => message(entry));
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row || row.carId !== query.carId) unavailable();
    const previous = rows[index - 1];
    if (previous && Number(previous.id) >= Number(row.id)) unavailable();
    if (query.before !== null && Number(row.id) > query.before) unavailable();
    if (query.snapshot !== null && Number(row.id) > query.snapshot) unavailable();
    const utc =
      typeof row.eventTimeUtc === 'string' ? row.eventTimeUtc.replace(' ', 'T') + 'Z' : null;
    if (query.fromDate && query.toDate && (!utc || utc < query.fromDate || utc > query.toDate))
      unavailable();
    if (
      query.parameterIds.length &&
      (!row.parameters.length ||
        row.parameters.some((entry) => !query.parameterIds.includes(entry.id)))
    )
      unavailable();
  }
  const items = rows.reverse().slice(0, query.pageSize);
  const snapshot = query.snapshot ?? Number(items[0]?.id);
  const hasMore = rows.length > query.pageSize;
  const last = items.at(-1);
  if (hasMore && (!last || Number(last.id) <= 1)) unavailable();
  return {
    items,
    hasMore,
    cursor: items.length ? edataCursor(query, query.before ?? snapshot, snapshot) : null,
    nextCursor: hasMore && last ? edataCursor(query, Number(last.id) - 1, snapshot) : null,
  };
}
