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
export function persistenceError(error: unknown, entity: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new NotFoundException(`${entity} not found`);
    if (error.code === 'P2003')
      throw new ConflictException(`${entity} is still referenced by another record.`);
  }
  throw error;
}
