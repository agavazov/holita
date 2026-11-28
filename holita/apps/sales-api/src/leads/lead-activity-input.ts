import { BadRequestException, NotFoundException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { GraphQLError } from 'graphql';
import { Prisma } from '../generated/prisma/client.js';

export function activityId(id: string, kind: 'note' | 'task' | 'offer'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
    throw new BadRequestException(`Lead and ${kind} IDs must be UUIDs`);
  }
  return id.toLowerCase();
}

export function salesFieldError(path: string, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

export function activityInstant(input: string): Date | null {
  const value = input.trim();
  const instant = new Date(value);
  if (
    !/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !isISO8601(value, { strict: true, strictSeparator: true }) ||
    Number.isNaN(instant.getTime())
  ) {
    return null;
  }
  return instant;
}

export function activityWriteError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    throw new NotFoundException(message);
  }
  throw error;
}
