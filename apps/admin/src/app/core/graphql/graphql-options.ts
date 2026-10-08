import { ApolloLink, InMemoryCache, type ApolloClient } from '@apollo/client/core';
import { ServerError } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import type { HttpLink } from 'apollo-angular/http';
import type { Language } from '../../i18n/messages';
import { defer, finalize } from 'rxjs';
import type { SubmittedWrites } from './submitted-writes';
import { OperationTypeNode } from 'graphql';

export function graphqlOptions(
  httpLink: HttpLink,
  uri: string,
  scope?: Readonly<{ storeId: string; language: Language }>,
  writes?: SubmittedWrites,
): ApolloClient.Options {
  if (
    scope &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope.storeId)
  )
    throw new Error('A UUID store context is required.');
  const storeId = scope?.storeId.toLowerCase();
  const scopedLanguage = scope?.language;
  const link = new ApolloLink((operation, forward) => {
    const language: unknown = operation.getContext()['language'];
    const requestId = crypto.randomUUID();
    operation.setContext({
      requestId,
      headers: {
        'x-request-id': requestId,
        'Accept-Language': scopedLanguage ?? (language === 'en' ? 'en' : 'bg'),
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
    });
    return defer(() => {
      const settled =
        operation.operationType === OperationTypeNode.MUTATION ? writes?.begin() : undefined;
      return forward(operation).pipe(finalize(() => settled?.()));
    });
  });
  const errors = new ErrorLink(({ error, operation }) => {
    const requestId: unknown =
      (ServerError.is(error) ? error.response.headers.get('x-request-id') : null) ??
      operation.getContext()['requestId'];
    // Keep Apollo's error identity/type, attaching only this operation's diagnostic ID.
    if (error instanceof Error && typeof requestId === 'string')
      Object.assign(error, { requestId });
  });
  return {
    link: ApolloLink.from([link, errors, httpLink.create({ uri })]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true },
    },
  };
}
