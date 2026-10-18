import type { SortDirection } from '../validation.js';

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, '\\$&');
}

/** Case-insensitive literal substring (ILIKE) with `%`, `_` and `\` escaped. */
export function literalContains(token: string) {
  return { contains: escapeLike(token), mode: 'insensitive' as const };
}

/** The same literal substring as an `ILIKE` pattern for raw SQL parameters. */
export function containsPattern(token: string): string {
  return `%${escapeLike(token)}%`;
}

/** Prisma order for a nullable column: NULLS LAST in both directions. */
export function nullsLast(direction: SortDirection) {
  return { sort: prismaDirection(direction), nulls: 'last' as const };
}

export function prismaDirection(direction: SortDirection): 'asc' | 'desc' {
  return direction === 'ASC' ? 'asc' : 'desc';
}
