import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { requireTenant } from './auth/demo-auth.js';
import { Prisma } from './generated/prisma/client.js';
import { dateOnlyToDate, isDateOnly } from './graphql/scalars.js';

// Concrete validation helpers shared by the Fleet services. Paths are input field names for
// mutation inputs and top-level argument names for list arguments (`filter`, `sort`, `search`);
// messages name the nested field. Messages stay English and below 300 UTF-16 units.

/** Verified Tenant and active Branch; every Fleet predicate includes both. */
export interface FleetScope {
  readonly tenantId: string;
  readonly branchId: string;
}

export interface FieldError {
  readonly path: string;
  readonly message: string;
}

export function invalid(path: string, message: string): never {
  throw new BadRequestException({ message, fieldErrors: [{ path, message }] });
}

/** One BAD_USER_INPUT carrying every field error; the message is the first error's. */
export function invalidFields(errors: readonly FieldError[]): never {
  const first = errors[0];
  if (!first) throw new BadRequestException('The input is invalid.');
  throw new BadRequestException({
    message: first.message,
    fieldErrors: errors.map(({ path, message }) => ({ path, message })),
  });
}

export function conflict(message: string): never {
  throw new ConflictException(message);
}

export function uuid(value: unknown, path: string): string {
  if (typeof value !== 'string' || !isUUID(value)) invalid(path, 'Use a valid UUID.');
  return value.toLowerCase();
}

export function optionalUuid(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : uuid(value, path);
}

export function requireScope(context: {
  tenantId: string | undefined;
  branchId: string | undefined;
}): FleetScope {
  return { tenantId: requireTenant(context), branchId: uuid(context.branchId, 'x-branch-id') };
}

export function text(value: unknown, path: string, max: number): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || Array.from(trimmed).length > max || trimmed.includes('\u0000'))
    invalid(path, `Use 1 to ${String(max)} supported characters.`);
  return trimmed;
}

export function optionalText(value: unknown, path: string, max: number): string | null {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim())
    ? null
    : text(value, path, max);
}

/** Optional trimmed text that must also match `pattern`; blank clears the field. */
export function optionalPattern(
  value: unknown,
  path: string,
  max: number,
  pattern: RegExp,
  message: string,
): string | null {
  const result = optionalText(value, path, max);
  if (result !== null && !pattern.test(result)) invalid(path, message);
  return result;
}

export function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    invalid(path, `Use a whole number from ${String(min)} to ${String(max)}.`);
  return value;
}

export function optionalInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number | null {
  return value === null || value === undefined ? null : integer(value, path, min, max);
}

export function finite(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    invalid(path, `Use a number from ${String(min)} to ${String(max)}.`);
  return value;
}

export function optionalFinite(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number | null {
  return value === null || value === undefined ? null : finite(value, path, min, max);
}

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !isDateOnly(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 2100 ? value : null;
}

/** Calendar date `YYYY-MM-DD` (a real day, years 1900–2100), returned unchanged. */
export function dateOnly(value: unknown, path: string): string {
  const result = parseDateOnly(value);
  if (result === null) invalid(path, 'Use a real calendar date YYYY-MM-DD from 1900 to 2100.');
  return result;
}

export function optionalDateOnly(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : dateOnly(value, path);
}

const dateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;

function parseDateTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = dateTimePattern.exec(value);
  if (!match) return null;
  const [
    ,
    year = '',
    month = '',
    day = '',
    hour = '',
    minute = '',
    second = '0',
    fraction = '',
    utc,
    sign,
    offsetHour = '0',
    offsetMinute = '0',
  ] = match;
  if (!isDateOnly(`${year}-${month}-${day}`) || Number(year) < 2000 || Number(year) > 2100)
    return null;
  const hours = Number(hour),
    minutes = Number(minute),
    seconds = Number(second),
    offsetHours = Number(offsetHour),
    offsetMinutes = Number(offsetMinute);
  if (hours > 23 || minutes > 59 || seconds > 59 || offsetHours > 23 || offsetMinutes > 59)
    return null;
  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3));
  const offset = utc ? 0 : (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
  const instant = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, seconds, milliseconds) -
      offset * 60_000,
  );
  return Number.isFinite(instant.getTime()) ? instant : null;
}

/** ISO 8601 instant with `Z` or `±hh:mm` (years 2000–2100), converted to a `Date`. */
export function dateTime(value: unknown, path: string): Date {
  const result = parseDateTime(value);
  if (result === null)
    invalid(path, 'Use an ISO 8601 date and time with Z or ±hh:mm from 2000 to 2100.');
  return result;
}

export function optionalDateTime(value: unknown, path: string): Date | null {
  return value === null || value === undefined ? null : dateTime(value, path);
}

/** Value of a closed enumeration; GraphQL already coerces enums, this re-checks direct calls. */
export function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  message = 'Choose a supported value.',
): T {
  const result = allowed.find((item) => item === value);
  if (result === undefined) invalid(path, message);
  return result;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T | null {
  return value === null || value === undefined ? null : enumValue(value, allowed, path);
}

/** Input enum list: at most `max` different values, returned in enumeration order. */
export function enumList<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  max: number,
): T[] {
  if (!Array.isArray(value)) invalid(path, 'Choose a list of supported values.');
  const selected = value.map((item: unknown) => enumValue(item, allowed, path));
  if (new Set(selected).size !== selected.length) invalid(path, 'Do not repeat values.');
  if (selected.length > max) invalid(path, `Choose at most ${String(max)} values.`);
  return allowed.filter((item) => selected.includes(item));
}

export function ids(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > 100) invalid(path, 'Choose at most 100 records.');
  const result = value.map((id: unknown) => uuid(id, path));
  if (new Set(result).size !== result.length) invalid(path, 'Do not repeat record IDs.');
  return result;
}

export function pagination(args: { offset?: number; limit?: number }) {
  const offset = args.offset ?? 0,
    limit = args.limit ?? 20;
  if (!Number.isInteger(offset) || offset < 0 || offset > 2147483647)
    invalid('offset', 'Use a nonnegative offset.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    invalid('limit', 'Use a limit from 1 to 100.');
  return { offset, limit };
}

/**
 * Search tokens: trimmed, at most 200 code points without NUL, split on Unicode whitespace into
 * at most five tokens. Each token must match one search field (AND across tokens).
 */
export function searchTokens(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'string') invalid('search', 'Use text to search.');
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (Array.from(trimmed).length > 200 || trimmed.includes('\u0000'))
    invalid('search', 'Use at most 200 supported characters to search.');
  const tokens = trimmed.split(/\s+/u);
  if (tokens.length > 5) invalid('search', 'Use at most 5 search words.');
  return tokens;
}

// Filter fields: null or omitted means no constraint; the path is always `filter`.

function filterValues(value: unknown, field: string): unknown[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 100)
    invalid('filter', `filter.${field}: choose 1 to 100 values.`);
  return value.map((item: unknown) => item);
}

export function idList(value: unknown, field: string): string[] | undefined {
  const values = filterValues(value, field);
  if (!values) return undefined;
  const result = values.map((id: unknown) => {
    if (typeof id !== 'string' || !isUUID(id)) invalid('filter', `filter.${field}: use valid IDs.`);
    return id.toLowerCase();
  });
  if (new Set(result).size !== result.length)
    invalid('filter', `filter.${field}: do not repeat values.`);
  return result;
}

export function enumFilter<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T[] | undefined {
  const values = filterValues(value, field);
  if (!values) return undefined;
  const result = values.map((item: unknown) =>
    enumValue(item, allowed, 'filter', `filter.${field}: choose supported values.`),
  );
  if (new Set(result).size !== result.length)
    invalid('filter', `filter.${field}: do not repeat values.`);
  return result;
}

/** `true` requires, `false` excludes, null/omitted applies no constraint. */
export function booleanFilter(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') invalid('filter', `filter.${field}: use true or false.`);
  return value;
}

export function integerFilter(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    invalid('filter', `filter.${field}: use a whole number from ${String(min)} to ${String(max)}.`);
  return value;
}

/** Half-open `DateTime` range: `from` inclusive, `to` exclusive, `to` after `from`. */
export function dateTimeRange(
  from: unknown,
  to: unknown,
  fields: { readonly from: string; readonly to: string },
): { from?: Date; to?: Date } {
  const bound = (value: unknown, field: string): Date | undefined => {
    if (value === null || value === undefined) return undefined;
    const result = parseDateTime(value);
    if (result === null)
      invalid('filter', `filter.${field}: use an ISO 8601 date and time with Z or ±hh:mm.`);
    return result;
  };
  const start = bound(from, fields.from),
    end = bound(to, fields.to);
  if (start && end && end.getTime() <= start.getTime())
    invalid('filter', `filter.${fields.to} must be after filter.${fields.from}.`);
  return { ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) };
}

/** Closed `Date` range: both bounds inclusive, `to` on or after `from`. */
export function dateOnlyRange(
  from: unknown,
  to: unknown,
  fields: { readonly from: string; readonly to: string },
): { from?: string; to?: string } {
  const bound = (value: unknown, field: string): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const result = parseDateOnly(value);
    if (result === null) invalid('filter', `filter.${field}: use a real date YYYY-MM-DD.`);
    return result;
  };
  const start = bound(from, fields.from),
    end = bound(to, fields.to);
  if (start && end && dateOnlyToDate(end).getTime() < dateOnlyToDate(start).getTime())
    invalid('filter', `filter.${fields.to} must not be before filter.${fields.from}.`);
  return { ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) };
}

export type SortDirection = 'ASC' | 'DESC';

/** Sort field of the list's enumeration, or its default; path `sort`. */
export function sortField<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return value === null || value === undefined
    ? fallback
    : enumValue(value, allowed, 'sort', 'Choose a supported sort field.');
}

export function sortDirection(value: unknown, fallback: SortDirection): SortDirection {
  return value === null || value === undefined
    ? fallback
    : enumValue(value, ['ASC', 'DESC'], 'sort', 'Choose ASC or DESC.');
}

/**
 * Unique index of a P2002 raised through `@prisma/adapter-pg`: the client wraps the adapter's
 * error in `meta.driverAdapterError`, whose cause names the index (or only its columns).
 */
export function uniqueViolation(
  error: unknown,
): { readonly index: string | null; readonly fields: readonly string[] } | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return null;
  const unknownIndex = { index: null, fields: [] };
  const adapterError = error.meta?.['driverAdapterError'];
  if (!(adapterError instanceof Error) || !('cause' in adapterError)) return unknownIndex;
  const cause = adapterError.cause;
  if (typeof cause !== 'object' || cause === null || !('constraint' in cause)) return unknownIndex;
  const constraint = cause.constraint;
  if (typeof constraint !== 'object' || constraint === null) return unknownIndex;
  if ('index' in constraint && typeof constraint.index === 'string')
    return { index: constraint.index, fields: [] };
  if ('fields' in constraint && Array.isArray(constraint.fields)) {
    const fields = constraint.fields.flatMap((field: unknown) =>
      typeof field === 'string' ? [field.replace(/^"(.*)"$/, '$1')] : [],
    );
    if (fields.length === constraint.fields.length) return { index: null, fields };
  }
  return unknownIndex;
}

/**
 * Rethrows a P2002 as BAD_USER_INPUT on the field of its unique index (or its single reported
 * non-scope column); other errors pass through unchanged.
 */
export function rethrowUniqueViolation(
  error: unknown,
  indexes: ReadonlyMap<string, FieldError>,
): void {
  const violation = uniqueViolation(error);
  if (!violation) return;
  const columns = violation.fields.filter((field) => field !== 'tenantId' && field !== 'branchId');
  const fieldError =
    (violation.index === null ? undefined : indexes.get(violation.index)) ??
    (columns.length === 1
      ? [...indexes.values()].find((candidate) => candidate.path === columns[0])
      : undefined);
  if (fieldError) invalidFields([fieldError]);
  throw new BadRequestException('A value that must be unique is already used.');
}

/** P2025 → NOT_FOUND, P2003 → CONFLICT with the entity's message; anything else is rethrown. */
export function persistenceError(error: unknown, entity: string, conflictMessage?: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new NotFoundException(`${entity} not found`);
    if (error.code === 'P2003')
      throw new ConflictException(
        conflictMessage ?? `${entity} is still referenced by another record.`,
      );
  }
  throw error;
}
