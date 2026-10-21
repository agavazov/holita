import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { Language } from '../../i18n/messages';
import { uiMessages } from '../i18n/messages';

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
 * The first localized error per known field path (at most 30 entries per GraphQL error,
 * compatibility messages up to 300 UTF-16 units). Reasons never come from English messages.
 * Concrete features may supply texts for their own validated reason codes.
 */
export function fieldErrors<F extends string>(
  error: unknown,
  fields: readonly F[],
  language: Language = 'en',
  reasonText?: (code: string, path: F) => string | undefined,
): Partial<Record<F, string>> {
  const result: Partial<Record<F, string>> = {};
  if (!CombinedGraphQLErrors.is(error)) {
    return result;
  }
  const text = uiMessages[language].validation;
  const reasons: Readonly<Record<string, string>> = {
    INVALID_VALUE: text.invalid,
    REQUIRED: text.required,
    INVALID_TYPE: text.invalid,
    INVALID_FORMAT: text.pattern,
    TOO_LONG: text.tooLong,
    TOO_MANY_ITEMS: text.tooManyItems,
    DUPLICATE_VALUE: text.duplicateValue,
    NOT_INTEGER: text.integer,
    OUT_OF_RANGE: text.outOfRange,
    UNSUPPORTED_VALUE: text.unsupportedValue,
    INVALID_RANGE: text.invalidRange,
  };
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
        const code =
          'code' in candidate &&
          typeof candidate.code === 'string' &&
          candidate.code.length >= 1 &&
          candidate.code.length <= 64 &&
          /^[A-Z]/.test(candidate.code) &&
          !/[^A-Z0-9_]/.test(candidate.code)
            ? candidate.code
            : null;
        result[path] = code
          ? (reasonText?.(code, path) ?? reasons[code] ?? text.invalid)
          : text.invalid;
      }
    }
  }
  return result;
}
