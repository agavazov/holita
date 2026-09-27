import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from './generated/prisma/client.js';

export function invalid(path: string, message: string): never {
  throw new BadRequestException({ message, fieldErrors: [{ path, message }] });
}
export function uuid(value: unknown, path: string): string {
  if (typeof value !== 'string' || !isUUID(value)) invalid(path, 'Use a valid UUID.');
  return value.toLowerCase();
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
export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'Choose true or false.');
  return value;
}
export function capacity(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647)
    invalid('capacity', 'Enter a positive whole number up to 2147483647.');
  return value;
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
export function lookup(args: {
  search?: string | null;
  active?: boolean | null;
  ids?: string[] | null;
}) {
  return {
    search: optionalText(args.search, 'search', 200),
    active: args.active == null ? undefined : boolean(args.active, 'active'),
    ids: args.ids == null ? undefined : ids(args.ids, 'ids'),
  };
}
export function persistenceError(error: unknown, entity: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new NotFoundException(`${entity} not found`);
    if (error.code === 'P2003')
      throw new ConflictException(`${entity} is still referenced by another record.`);
    if (error.code === 'P2002')
      invalid(
        entity === 'Event' ? 'code' : 'name',
        `${entity === 'Event' ? 'Code' : 'Name'} is already used in this store.`,
      );
  }
  throw error;
}

export function instant(value: unknown, path: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
    invalid(path, 'Enter a valid date and time.');
  return value;
}
