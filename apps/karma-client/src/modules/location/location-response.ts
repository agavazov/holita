import { ServiceUnavailableException } from '@nestjs/common';
import type { KarmaLocation } from '../../generated/graphql/types.js';

function unavailable(): never {
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function id(value: unknown, minimum = 1): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    unavailable();
  }
  return String(value);
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    unavailable();
  }
  return value;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    unavailable();
  }
  return value;
}

function timestamp(value: unknown): string | null {
  const result = text(value);
  if (result !== null && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result)) {
    unavailable();
  }
  return result;
}

export function location(value: unknown, carId: string): KarmaLocation | null {
  if (!Array.isArray(value) || value.length > 1) {
    unavailable();
  }
  if (!value.length) {
    return null;
  }
  const row: unknown = value[0];
  if (
    !object(row) ||
    id(row['car_id']) !== carId ||
    typeof row['device_id'] !== 'string' ||
    typeof row['carnumber'] !== 'string'
  ) {
    unavailable();
  }
  return {
    carId,
    deviceId: row['device_id'],
    carNumber: row['carnumber'],
    messageId: id(row['message_id']),
    eventId: id(row['eid'], 0),
    edt: timestamp(row['edt']),
    edtTz: timestamp(row['edt_tz']),
    pdt: timestamp(row['pdt']),
    latitude: number(row['latitude']),
    longitude: number(row['longitude']),
    spd: number(row['spd']),
    odo: number(row['odo']),
    extra: text(row['extra']),
  };
}
