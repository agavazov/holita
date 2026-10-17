import { ServiceUnavailableException } from '@nestjs/common';
import type { KarmaCar } from '../../generated/graphql/types.js';

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('Karma is unavailable; try again later');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw unavailable();
  return String(value);
}

function text(value: unknown, required = false): string | null {
  if (typeof value === 'string') return value;
  if (!required && (value === null || value === undefined)) return null;
  throw unavailable();
}

function car(value: unknown): KarmaCar {
  if (!record(value)) throw unavailable();
  const deviceId = text(value['device_id'], true);
  const carNumber = text(value['car_number'], true);
  if (deviceId === null || carNumber === null) throw unavailable();
  const year = value['car_year'];
  const timeZone = value['time_zone'];
  const drivers = value['driver_ids'];
  if (
    timeZone !== null &&
    timeZone !== undefined &&
    (typeof timeZone !== 'number' ||
      !Number.isInteger(timeZone) ||
      timeZone < 0 ||
      timeZone > 2147483647)
  )
    throw unavailable();
  if (drivers !== null && drivers !== undefined && !Array.isArray(drivers)) throw unavailable();
  return {
    id: identifier(value['car_id']),
    projectId: identifier(value['project_id']),
    deviceId,
    carNumber,
    carType: text(value['car_type']),
    carYear: typeof year === 'number' && Number.isFinite(year) ? String(year) : text(year),
    carColor: text(value['car_color']),
    subType: text(value['sub_type']),
    timeZoneId: typeof timeZone === 'number' ? timeZone : null,
    driverCount: Array.isArray(drivers) ? drivers.length : null,
  };
}

export function cars(data: unknown): KarmaCar[] {
  if (!Array.isArray(data)) throw unavailable();
  const result = data.map((value: unknown) => car(value));
  if (new Set(result.map((entry) => entry.id)).size !== result.length) throw unavailable();
  return result;
}
