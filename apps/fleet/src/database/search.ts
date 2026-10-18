import type { SortDirection } from '../validation.js';

/** Case-insensitive literal substring (ILIKE) with `%`, `_` and `\` escaped. */
export function literalContains(token: string) {
  return { contains: token.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}

/** Prisma order for a nullable column: NULLS LAST in both directions. */
export function nullsLast(direction: SortDirection) {
  return { sort: prismaDirection(direction), nulls: 'last' as const };
}

export function prismaDirection(direction: SortDirection): 'asc' | 'desc' {
  return direction === 'ASC' ? 'asc' : 'desc';
}
