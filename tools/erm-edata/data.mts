import { createHash } from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject {
  [key: string]: Json;
}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function object(value: unknown): JsonObject {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected JSON object',
  );
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) result[key] = json(child);
  return result;
}
export function json(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    requireValue(Number.isFinite(value), 'Nonfinite JSON number');
    return value;
  }
  if (Array.isArray(value)) return value.map(json);
  return object(value);
}
export function array(value: Json | undefined): Json[] {
  requireValue(Array.isArray(value), 'Expected JSON array');
  return value;
}
export function string(value: Json | undefined): string {
  requireValue(typeof value === 'string', 'Expected string');
  return value;
}
export function number(value: Json | undefined): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), 'Expected number');
  return value;
}
export function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  requireValue(value !== undefined, `Missing item ${String(index)}`);
  return value;
}
export function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`)
      .join(',')}}`;
  requireValue(typeof value !== 'number' || Number.isFinite(value), 'Nonfinite JSON number');
  return JSON.stringify(value);
}
export interface Location extends JsonObject {
  kind: string;
  path: string;
  offset: number;
  bytes: number;
}
export interface Workbook {
  key: string;
  payload: Buffer;
  locations: Location[];
}
export interface Parameter extends JsonObject {
  key: string;
  sourceKey: string;
  parameterId: number;
  category: string;
  name: string;
  multiply: string | null;
  offset: string | null;
  details: JsonObject;
}
export interface Catalog extends JsonObject {
  schemaVersion: number;
  extractorVersion: string;
  packageLabel: string;
  source: JsonObject;
  sources: JsonObject[];
  parameters: Parameter[];
  sets: JsonObject[];
  profiles: JsonObject[];
  categories: JsonObject[];
  mappings: JsonObject[];
  issues: JsonObject[];
  coverage: JsonObject;
}
