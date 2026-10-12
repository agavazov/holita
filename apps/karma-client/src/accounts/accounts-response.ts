import { ServiceUnavailableException } from '@nestjs/common';
import type { KarmaRole, KarmaUser } from '../generated/graphql/types.js';

function unavailable(): never {
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function identifier(value: unknown, minimum = 0): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) unavailable();
  return String(value);
}
function text(value: unknown): string {
  if (typeof value !== 'string') unavailable();
  return value;
}

export function users(value: unknown): KarmaUser[] {
  if (!Array.isArray(value)) unavailable();
  const rows = value.map((row: unknown) => {
    if (!object(row)) unavailable();
    const active = row['active'],
      zone = row['time_zone'],
      expiry = row['expire_date'],
      projects = row['project_ids'];
    if (
      typeof active !== 'number' ||
      !Number.isFinite(active) ||
      typeof zone !== 'number' ||
      !Number.isInteger(zone) ||
      zone < 0 ||
      zone > 2147483647 ||
      (expiry !== null && typeof expiry !== 'string') ||
      !Array.isArray(projects)
    )
      unavailable();
    return {
      id: identifier(row['user_id'], 1),
      userName: text(row['user_name']),
      active,
      expireDate: expiry,
      roleId: identifier(row['role_id'], 1),
      firstName: text(row['first_name']),
      lastName: text(row['last_name']),
      timeZoneId: zone,
      email: text(row['email']),
      projectId: identifier(row['project_id']),
      projectIds: projects.map((id: unknown) => identifier(id)),
    };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) unavailable();
  return rows;
}

export function roles(value: unknown): KarmaRole[] {
  if (!Array.isArray(value)) unavailable();
  const rows = value.map((row: unknown) => {
    if (!object(row)) unavailable();
    return { id: identifier(row['role_id'], 1), description: text(row['description']) };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) unavailable();
  return rows;
}
