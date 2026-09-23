import { unwrapResolverError } from '@apollo/server/errors';
import type { ApolloServerPlugin } from '@apollo/server';
import { HttpException, Logger } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';
import type { RequestContext } from './request-context.js';

const logger = new Logger('GraphQL');
const codes = new Map([
  [400, 'BAD_USER_INPUT'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [503, 'SERVICE_UNAVAILABLE'],
]);
const publicCodes = new Set([
  ...codes.values(),
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_REQUEST',
]);

export const graphqlDiagnostics: ApolloServerPlugin<RequestContext> = {
  requestDidStart() {
    return Promise.resolve({
      didEncounterErrors({ errors, contextValue }) {
        for (const error of errors) {
          error.extensions['requestId'] = contextValue.requestId;
          const cause: unknown = unwrapResolverError(error);
          const code = error.extensions['code'];
          if (
            (cause instanceof HttpException && codes.has(cause.getStatus())) ||
            (typeof code === 'string' && publicCodes.has(code))
          )
            continue;
          logger.error({
            requestId: contextValue.requestId,
            error: cause instanceof Error ? cause.name : 'UnknownError',
            stack:
              cause instanceof Error
                ? cause.stack
                    ?.split('\n')
                    .filter((line) => line.trimStart().startsWith('at '))
                    .join('\n')
                : undefined,
          });
        }
        return Promise.resolve();
      },
    });
  },
};

export function formatGraphqlError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const requestId = formatted.extensions?.['requestId'];
  const trace = typeof requestId === 'string' ? { requestId } : {};
  const original: unknown = unwrapResolverError(error);
  if (original instanceof HttpException) {
    const code = codes.get(original.getStatus());
    if (code) return { ...formatted, message: original.message, extensions: { code, ...trace } };
  }
  const code = formatted.extensions?.['code'];
  if (typeof code === 'string' && publicCodes.has(code))
    return { ...formatted, extensions: { code, ...trace } };
  return {
    ...formatted,
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR', ...trace },
  };
}
