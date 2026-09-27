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

function fieldErrors(value: unknown): { path: string; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry: unknown) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('path' in entry) ||
      !('message' in entry) ||
      typeof entry.path !== 'string' ||
      typeof entry.message !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9]*$/.test(entry.path) ||
      entry.message.length > 300
    )
      return [];
    return [{ path: entry.path, message: entry.message }];
  });
}

export function formatGraphqlError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const requestId = formatted.extensions?.['requestId'];
  const trace = typeof requestId === 'string' ? { requestId } : {};
  const original: unknown = unwrapResolverError(error);
  if (original instanceof HttpException) {
    const code = codes.get(original.getStatus());
    if (code) {
      const response = original.getResponse();
      const details =
        code === 'BAD_USER_INPUT' && typeof response === 'object' && 'fieldErrors' in response
          ? fieldErrors(response.fieldErrors)
          : [];
      return {
        ...formatted,
        message: original.message,
        extensions: { code, ...trace, ...(details.length ? { fieldErrors: details } : {}) },
      };
    }
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
