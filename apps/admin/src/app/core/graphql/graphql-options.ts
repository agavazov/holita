import { ApolloLink, InMemoryCache, type ApolloClient } from '@apollo/client/core';
import { ServerError } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import type { HttpLink } from 'apollo-angular/http';
import type { Language } from '../../i18n/messages';

export function graphqlOptions(
  httpLink: HttpLink,
  uri: string,
  scope?: Readonly<{ branchId: string; language: Language }>,
  session?: Readonly<{ tenantId: string; token: string }>,
): ApolloClient.Options {
  if (
    scope &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope.branchId)
  )
    throw new Error('A UUID branch context is required.');
  const branchId = scope?.branchId.toLowerCase();
  const scopedLanguage = scope?.language;
  const link = new ApolloLink((operation, forward) => {
    const language: unknown = operation.getContext()['language'];
    const requestId = crypto.randomUUID();
    operation.setContext({
      requestId,
      headers: {
        'x-request-id': requestId,
        'Accept-Language': scopedLanguage ?? (language === 'en' ? 'en' : 'bg'),
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
    });
    return forward(operation);
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
