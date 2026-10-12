import { ServiceUnavailableException } from '@nestjs/common';
import type { KarmaProject, KarmaTimeZone, KarmaVersion } from '../generated/graphql/types.js';

function unavailable(): never {
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function projects(value: unknown): KarmaProject[] {
  if (!Array.isArray(value)) unavailable();
  const rows = value.map((row: unknown) => {
    if (!object(row)) unavailable();
    const id = row['project_id'],
      name = row['name'];
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || typeof name !== 'string')
      unavailable();
    return { id: String(id), name };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) unavailable();
  return rows;
}

export function timeZones(value: unknown): KarmaTimeZone[] {
  if (!Array.isArray(value)) unavailable();
  const rows = value.map((row: unknown) => {
    if (!object(row)) unavailable();
    const id = row['zone_id'],
      name = row['zone_name'];
    if (
      typeof id !== 'number' ||
      !Number.isInteger(id) ||
      id < 0 ||
      id > 2147483647 ||
      typeof name !== 'string' ||
      !name.trim()
    )
      unavailable();
    return { id, name };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) unavailable();
  return rows;
}

export function version(value: unknown): KarmaVersion {
  if (!object(value) || typeof value['version'] !== 'string' || !value['version'].trim())
    unavailable();
  return { version: value['version'] };
}
