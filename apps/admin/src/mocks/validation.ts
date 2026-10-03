import isEmail from 'validator/lib/isEmail.js';
import isUUID from 'validator/lib/isUUID.js';
import { DataError } from '../data/data-error.js';
import type {
  ProductDetailsFragment,
  ListReferenceVenuesQueryVariables,
} from '../generated/graphql/operations.js';
import { prototypeStores } from './fixtures.js';

export function invalid(path: string, message: string): never {
  throw new DataError(message, undefined, [{ path, message }]);
}

export function uuid(value: unknown, path: string) {
  if (typeof value !== 'string' || !isUUID(value)) invalid(path, 'Use a valid UUID.');
  return value.toLowerCase();
}

export function text(value: unknown, path: string, max: number): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || Array.from(result).length > max || result.includes('\u0000'))
    invalid(path, `Use 1 to ${String(max)} supported characters.`);
  return result;
}

export function optionalText(value: unknown, path: string, max: number) {
  return value == null || (typeof value === 'string' && !value.trim())
    ? null
    : text(value, path, max);
}

export function boolean(value: unknown, path = 'active') {
  if (typeof value !== 'boolean') invalid(path, 'Choose true or false.');
  return value;
}

export function email(value: unknown) {
  const result = optionalText(value, 'email', 254);
  if (result && !isEmail(result)) invalid('email', 'Enter a valid email address.');
  return result;
}

export function capacity(value: unknown, path = 'capacity') {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647)
    invalid(path, 'Enter a positive whole number up to 2147483647.');
  return value;
}

export function ids(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > 100) invalid(path, 'Choose at most 100 records.');
  const result = value.map((id: unknown) => uuid(id, path));
  if (new Set(result).size !== result.length) invalid(path, 'Do not repeat record IDs.');
  return result;
}

export function instant(value: unknown, path: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    invalid(path, 'Enter a valid date and time.');
  return new Date(value).toISOString();
}

export function countryCode(value: unknown) {
  const result = text(value, 'countryCode', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(result)) invalid('countryCode', 'Use a two-letter country code.');
  return result;
}

export function color(value: unknown) {
  const result = text(value, 'color', 7);
  if (!/^#[0-9a-f]{6}$/i.test(result)) invalid('color', 'Use a six-digit hex color, e.g. #315ed0.');
  return result.toLowerCase();
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

export function lookup(args: Pick<ListReferenceVenuesQueryVariables, 'search' | 'active' | 'ids'>) {
  const ids =
    args.ids == null
      ? undefined
      : (Array.isArray(args.ids) ? args.ids : [args.ids]).map((id) => uuid(id, 'ids'));
  if (ids && ids.length > 100) invalid('ids', 'Choose at most 100 records.');
  if (ids && new Set(ids).size !== ids.length) invalid('ids', 'Do not repeat record IDs.');
  return {
    search: optionalText(args.search, 'search', 200)?.toLowerCase(),
    active: args.active == null ? undefined : boolean(args.active),
    ids,
  };
}

export function direction(value: unknown) {
  const result = value ?? 'DESC';
  if (result !== 'ASC' && result !== 'DESC') invalid('sort.direction', 'Choose ASC or DESC.');
  return result === 'ASC' ? 1 : -1;
}

export function requireStore(storeId: string) {
  if (!prototypeStores.some((store) => store.id === storeId))
    throw new DataError('Store not found');
}

export function uniqueName(
  rows: readonly { id: string; storeId: string; name: string }[],
  row: { id: string; storeId: string; name: string },
) {
  if (
    rows.some(
      (previous) =>
        previous.storeId === row.storeId && previous.name === row.name && previous.id !== row.id,
    )
  )
    invalid('name', 'Name is already used in this store.');
}

export function validText(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    Boolean(value) &&
    value.trim() === value &&
    Array.from(value).length <= max &&
    !value.includes('\u0000')
  );
}

export function validOptionalText(value: unknown, max: number): value is string | null {
  return value === null || validText(value, max);
}

export function validRecord(
  value: unknown,
): value is Pick<ProductDetailsFragment, 'id' | 'storeId' | 'createdAt' | 'updatedAt'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    isUUID(value.id) &&
    value.id === value.id.toLowerCase() &&
    'storeId' in value &&
    prototypeStores.some((store) => store.id === value.storeId) &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

export function distinctRecords(
  rows: readonly { id: string; storeId: string }[],
  keys: readonly string[],
) {
  return (
    new Set(rows.map((row) => row.id)).size === rows.length && new Set(keys).size === rows.length
  );
}
