import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function requestError(error: unknown, fallback: string): string {
  if (!CombinedGraphQLErrors.is(error)) return fallback;
  const requestId: unknown = error.errors[0]?.extensions?.['requestId'];
  return typeof requestId === 'string' ? `${error.message} (${requestId})` : error.message;
}
