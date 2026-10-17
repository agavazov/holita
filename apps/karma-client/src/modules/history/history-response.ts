import { ServiceUnavailableException } from '@nestjs/common';
import type { KarmaTrip, KarmaEvent, KarmaDrivingProfile } from '../../generated/graphql/types.js';
import { historyCursor, type HistoryQuery } from './history-query.js';
function unavailable(): never {
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(value: unknown, minimum = 1): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) unavailable();
  return String(value);
}
function optionalId(value: unknown): string | null {
  return value === null || value === undefined ? null : id(value, 0);
}
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') unavailable();
  return value;
}
function required(value: unknown): string {
  const result = text(value);
  if (result === null) unavailable();
  return result;
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
function trip(value: unknown): KarmaTrip {
  if (!object(value)) unavailable();
  return {
    id: id(value['trip_id']),
    carId: id(value['car_id']),
    carNumber: required(value['car_number']),
    deviceId: required(value['device_id']),
    driverId: optionalId(value['driver_id']),
    tripActive: number(value['trip_active']),
    startMessageId: optionalId(value['start_message_id']),
    startDate: timestamp(value['start_date']),
    startLatitude: number(value['start_latitude']),
    startLongitude: number(value['start_longitude']),
    startOdo: number(value['start_odo']),
    stopMessageId: optionalId(value['stop_message_id']),
    stopDate: timestamp(value['stop_date']),
    stopLatitude: number(value['stop_latitude']),
    stopLongitude: number(value['stop_longitude']),
    stopOdo: number(value['stop_odo']),
    tripDuration: number(value['trip_duration']),
    tripDistance: number(value['trip_distance']),
    tripDurationNight: number(value['trip_duration_night']),
    tripDistanceNight: number(value['trip_distance_night']),
    maxSpeed: number(value['max_speed']),
    drivingScore: number(value['driving_score']),
    ecoScore: number(value['eco_score']),
  };
}
function event(value: unknown): KarmaEvent {
  if (!object(value)) unavailable();
  return {
    id: id(value['message_id']),
    carId: id(value['car_id']),
    deviceId: required(value['device_id']),
    eventId: id(value['eid'], 0),
    edt: timestamp(value['edt']),
    edtTz: timestamp(value['edt_tz']),
    pdt: timestamp(value['pdt']),
    latitude: number(value['latitude']),
    longitude: number(value['longitude']),
    spd: number(value['spd']),
    odo: number(value['odo']),
    extra: text(value['extra']),
  };
}
function page<T extends { id: string; carId: string }>(rows: T[], query: HistoryQuery) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i],
      previous = rows[i - 1];
    if (
      !row ||
      row.carId !== query.carId ||
      (previous && Number(previous.id) >= Number(row.id)) ||
      (query.before !== null && Number(row.id) > query.before) ||
      (query.snapshot !== null && Number(row.id) > query.snapshot)
    )
      unavailable();
  }
  const items = rows.slice().reverse().slice(0, query.pageSize),
    snapshot = query.snapshot ?? Number(items[0]?.id),
    last = items.at(-1);
  const hasMore = rows.length > query.pageSize;
  if (hasMore && (!last || Number(last.id) <= 1)) unavailable();
  return {
    items,
    hasMore,
    cursor: items.length ? historyCursor(query, query.before ?? snapshot, snapshot) : null,
    nextCursor: hasMore && last ? historyCursor(query, Number(last.id) - 1, snapshot) : null,
  };
}
export function tripsPage(value: unknown, query: HistoryQuery) {
  if (!Array.isArray(value)) unavailable();
  return page(
    value.map((entry: unknown) => trip(entry)),
    query,
  );
}
export function eventsPage(value: unknown, query: HistoryQuery) {
  if (!Array.isArray(value) || value.length > 500) unavailable();
  const rows = value.map((entry: unknown) => event(entry));
  for (const row of rows) {
    const utc = typeof row.edt === 'string' ? row.edt.replace(' ', 'T') + 'Z' : null;
    if (query.fromDate && query.toDate && (!utc || utc < query.fromDate || utc > query.toDate))
      unavailable();
    if (query.eventTypes.length && !query.eventTypes.includes(row.eventId)) unavailable();
  }
  return page(rows, query);
}
export const drivingCategories = [
  'accelerations',
  'brakes',
  'speed_bumps',
  'bypassing',
  'roundabout',
  'lane_change',
  'turns',
  'off_road',
  'speed',
] as const;
export function drivingProfile(value: unknown, carId: string): KarmaDrivingProfile | null {
  if (!Array.isArray(value) || value.length > 1) unavailable();
  if (!value.length) return null;
  const row: unknown = value[0];
  if (!object(row) || id(row['car_id']) !== carId || !object(row['score'])) unavailable();
  const scores = row['score'];
  if (Object.keys(scores).length !== drivingCategories.length) unavailable();
  return {
    carId,
    carNumber: required(row['car_number']),
    deviceId: required(row['device_id']),
    categories: drivingCategories.map((name) => {
      const category = scores[name];
      if (!object(category)) unavailable();
      return { name, score: number(category['score']), weight: number(category['weight']) };
    }),
  };
}
