import { CombinedGraphQLErrors } from '@apollo/client/errors';

/** GraphQL error codes the admin handles explicitly (backend error model). */
export type ErrorCode =
  'BAD_USER_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_UNAVAILABLE' | 'UNAUTHENTICATED';

const errorCodes: readonly ErrorCode[] = [
  'BAD_USER_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'SERVICE_UNAVAILABLE',
  'UNAUTHENTICATED',
];

/** The first known `extensions.code` of a GraphQL error result, or `null`. */
export function errorCode(error: unknown): ErrorCode | null {
  if (!CombinedGraphQLErrors.is(error)) {
    return null;
  }
  for (const failure of error.errors) {
    const code: unknown = failure.extensions?.['code'];
    const known = errorCodes.find((candidate) => candidate === code);
    if (known) {
      return known;
    }
  }
  return null;
}

/**
 * The first server message per known field path from `extensions.fieldErrors` (at most 30
 * entries read, messages up to 300 characters). Drawers prefer their own catalog text per path.
 */
export function fieldErrors<F extends string>(
  error: unknown,
  fields: readonly F[],
): Partial<Record<F, string>> {
  const result: Partial<Record<F, string>> = {};
  if (!CombinedGraphQLErrors.is(error)) {
    return result;
  }
  for (const failure of error.errors) {
    const entries: unknown = failure.extensions?.['fieldErrors'];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries.slice(0, 30)) {
      const candidate: unknown = entry;
      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        !('path' in candidate) ||
        !('message' in candidate) ||
        typeof candidate.message !== 'string' ||
        candidate.message.length > 300
      ) {
        continue;
      }
      const path = fields.find((field) => field === candidate.path);
      if (path && result[path] === undefined) {
        result[path] = candidate.message;
      }
    }
  }
  return result;
}
