import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function requestError(error: unknown, fallback: string): string {
  const message = CombinedGraphQLErrors.is(error) ? error.message : fallback;
  const requestId: unknown = CombinedGraphQLErrors.is(error)
    ? error.errors[0]?.extensions?.['requestId']
    : error instanceof Error && 'requestId' in error
      ? error.requestId
      : undefined;
  return typeof requestId === 'string' ? `${message} (${requestId})` : message;
}
