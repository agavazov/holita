export function malformed(field: string): never {
  throw new TypeError(`Invalid ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function object(
  value: unknown,
  field: string,
  keys?: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) {
    return malformed(field);
  }
  if (keys && Object.keys(value).some((key) => !keys.includes(key))) {
    return malformed(field);
  }
  return value;
}

export function string(value: unknown, field: string): string {
  return typeof value === 'string' ? value : malformed(field);
}

export function text(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value || (pattern && !pattern.test(value))) {
    return malformed(field);
  }
  return value;
}

export function imei(value: unknown): string {
  return text(value, 'imei', /^\d{15}$/);
}

export function uuid(value: unknown, field: string): string {
  return text(value, field, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
}

export function decimalId(value: unknown, field: string): bigint {
  return BigInt(text(value, field, /^\d+$/));
}

export function date(value: unknown, field: string): Date {
  const iso = text(value, field, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);
  const result = new Date(iso);
  const canonical = iso.includes('.') ? iso : iso.replace('Z', '.000Z');
  if (!Number.isFinite(result.getTime()) || result.toISOString() !== canonical) {
    return malformed(field);
  }
  return result;
}

export function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return malformed(field);
  }
  return value;
}

export function integer(
  value: unknown,
  field: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = number(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return malformed(field);
  }
  return parsed;
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    return malformed(field);
  }
  return value;
}

export function oneOf<T extends string>(value: unknown, field: string, values: readonly T[]): T {
  return values.find((entry) => entry === value) ?? malformed(field);
}

export function nullable<T>(
  value: unknown,
  field: string,
  parse: (value: unknown, field: string) => T,
): T | null {
  return value === null ? null : parse(value, field);
}

export function array<T>(value: unknown, field: string, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    return malformed(field);
  }
  return Array.from(value, parse);
}

export function imeis(value: unknown, minimum: number): string[] {
  const result = array(value, 'imeis', imei);
  if (result.length < minimum || result.length > 500) {
    return malformed('imeis');
  }
  return [...new Set(result)];
}

export function queryLimit(value: unknown): number {
  return integer(Number(text(value, 'limit', /^\d+$/)), 'limit', 1, 500);
}

export function acknowledgement(
  value: unknown,
  requestId: (value: unknown, field: string) => string,
) {
  const ack = object(value, 'acknowledgement');
  return {
    commandId: text(ack.commandId, 'commandId'),
    commandRequestId: nullable(ack.commandRequestId, 'commandRequestId', requestId),
    resultCode: string(ack.resultCode, 'resultCode'),
    receivedAt: date(ack.receivedAt, 'receivedAt'),
  };
}
