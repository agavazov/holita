import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesCreateOfferDocument,
  SalesOfferDocument,
  SalesOffersDocument,
  SalesUpdateOfferDocument,
  type SalesOfferInput,
  type SalesOffersQueryVariables,
} from '../generated/offers-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class OffersApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  async list(
    scope: SalesWorkspaceScope,
    variables: SalesOffersQueryVariables,
    signal: AbortSignal,
  ) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({ query: SalesOffersDocument, variables, fetchPolicy: 'no-cache', context }),
      signal,
    );
    return data.salesOffers;
  }

  async find(scope: SalesWorkspaceScope, id: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesOfferDocument,
          variables: { id },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.salesOffer;
  }

  async save(
    scope: SalesWorkspaceScope,
    input: SalesOfferInput,
    id: string | null,
    leadId: string | null,
  ) {
    if (id) {
      const { updateSalesOffer } = await this.request(scope, (client, context) =>
        client.mutate({ mutation: SalesUpdateOfferDocument, variables: { id, input }, context }),
      );
      return updateSalesOffer.id;
    }
    const { createSalesOffer } = await this.request(scope, (client, context) =>
      client.mutate({ mutation: SalesCreateOfferDocument, variables: { leadId, input }, context }),
    );
    return createSalesOffer.id;
  }

  private async request<TData>(
    scope: SalesWorkspaceScope,
    run: (
      client: ApolloClient,
      context: { language: SalesWorkspaceScope['language'] },
    ) => Promise<{ data?: TData | null | undefined }>,
    signal?: AbortSignal,
  ): Promise<TData> {
    const client = new ApolloClient(
      graphqlOptions(this.link, this.config.graphqlUrl, undefined, scope),
    );
    const stop = () => {
      client.stop();
    };
    signal?.addEventListener('abort', stop, { once: true });
    try {
      const { data } = await run(client, { language: scope.language });
      if (!data) {
        throw new Error('Missing Sales offer result');
      }
      return data;
    } finally {
      signal?.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
