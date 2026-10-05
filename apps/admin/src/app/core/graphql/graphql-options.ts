import { ApolloLink, InMemoryCache, type ApolloClient } from '@apollo/client/core';
import type { HttpLink } from 'apollo-angular/http';
import type { Language } from '../../i18n/messages';

export function graphqlOptions(
  httpLink: HttpLink,
  uri: string,
  scope?: Readonly<{ storeId: string; language: Language }>,
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
    operation.setContext({
      headers: {
        'x-request-id': crypto.randomUUID(),
        'Accept-Language': scopedLanguage ?? (language === 'en' ? 'en' : 'bg'),
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
    });
    return forward(operation);
  });
  return {
    link: link.concat(httpLink.create({ uri })),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true },
    },
  };
}
