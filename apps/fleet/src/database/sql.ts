import { Prisma } from '../generated/prisma/client.js';

// Helpers for the few raw queries Fleet runs (vehicle facts, service urgency, score aggregates).
// The adapter does not set `search_path`, so every table reference is schema-qualified; raw rows
// are `unknown` and each query parses them with these readers instead of trusting a type argument.

export type FleetTableName =
  | 'Vehicle'
  | 'Device'
  | 'Driver'
  | 'VehicleGroup'
  | 'VehicleStatusSample'
  | 'Trip'
  | 'FleetEvent'
  | 'ServiceTask';

const FLEET_TABLES: readonly FleetTableName[] = [
  'Vehicle',
  'Device',
  'Driver',
  'VehicleGroup',
  'VehicleStatusSample',
  'Trip',
  'FleetEvent',
  'ServiceTask',
];

/** `"<schema>"."<table>"` for one of the Fleet tables; the schema name is quoted safely. */
export function fleetTable(schema: string, table: FleetTableName): Prisma.Sql {
  if (!schema || schema.includes('\u0000')) {
    throw new Error('Invalid Fleet database schema name');
  }
  if (!FLEET_TABLES.includes(table)) {
    throw new Error('Unknown Fleet table');
  }
  return Prisma.raw(`"${schema.replaceAll('"', '""')}"."${table}"`);
}

function invalidRow(key: string): never {
  throw new Error(`Unexpected database value for ${key}`);
}

export function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Unexpected database row');
  }
  return Object.fromEntries(Object.entries(value));
}

/** Rows of a `$queryRaw` result, each parsed by `parse`. */
export function rowsOf<T>(value: unknown, parse: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error('Unexpected database result');
  }
  return value.map((row: unknown) => parse(recordOf(row)));
}

export function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    invalidRow(key);
  }
  return value;
}

export function textOrNull(row: Record<string, unknown>, key: string): string | null {
  return row[key] === null ? null : text(row, key);
}

/** A text column that must be one of `allowed` (enum columns are selected as `::text`). */
export function oneOf<T extends string>(
  row: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = row[key];
  const result = allowed.find((item) => item === value);
  if (result === undefined) {
    invalidRow(key);
  }
  return result;
}

export function oneOfOrNull<T extends string>(
  row: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null {
  return row[key] === null ? null : oneOf(row, key, allowed);
}

export function numberOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidRow(key);
  }
  return value;
}

export function number(row: Record<string, unknown>, key: string): number {
  const value = numberOrNull(row, key);
  if (value === null) {
    invalidRow(key);
  }
  return value;
}

export function integerOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = numberOrNull(row, key);
  if (value !== null && !Number.isSafeInteger(value)) {
    invalidRow(key);
  }
  return value;
}

export function integer(row: Record<string, unknown>, key: string): number {
  const value = integerOrNull(row, key);
  if (value === null) {
    invalidRow(key);
  }
  return value;
}

/** A `timestamptz` read as an instant; the driver returns a `Date` or an ISO string. */
export function dateOrNull(row: Record<string, unknown>, key: string): Date | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  const result =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
  if (!result || Number.isNaN(result.getTime())) {
    invalidRow(key);
  }
  return result;
}

export function date(row: Record<string, unknown>, key: string): Date {
  const value = dateOrNull(row, key);
  if (value === null) {
    invalidRow(key);
  }
  return value;
}

export function booleanOrNull(row: Record<string, unknown>, key: string): boolean | null {
  const value = row[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'boolean') {
    invalidRow(key);
  }
  return value;
}

export function boolean(row: Record<string, unknown>, key: string): boolean {
  const value = booleanOrNull(row, key);
  if (value === null) {
    invalidRow(key);
  }
  return value;
}
