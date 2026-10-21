import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function requestError(error: unknown, fallback: string): string {
  const hasFieldErrors =
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((failure) => {
      const entries: unknown = failure.extensions?.['fieldErrors'];
      return (
        failure.extensions?.['code'] === 'BAD_USER_INPUT' &&
        Array.isArray(entries) &&
        entries
          .slice(0, 30)
          .some(
            (entry: unknown) =>
              typeof entry === 'object' &&
              entry !== null &&
              'path' in entry &&
              typeof entry.path === 'string' &&
              /^[a-zA-Z]/.test(entry.path) &&
              !/[^a-zA-Z0-9]/.test(entry.path) &&
              'message' in entry &&
              typeof entry.message === 'string' &&
              entry.message.length <= 300,
          )
      );
    });
  const message = CombinedGraphQLErrors.is(error) && !hasFieldErrors ? error.message : fallback;
  const requestId: unknown = CombinedGraphQLErrors.is(error)
    ? error.errors[0]?.extensions?.['requestId']
    : error instanceof Error && 'requestId' in error
      ? error.requestId
      : undefined;
  return typeof requestId === 'string' ? `${message} (${requestId})` : message;
}
