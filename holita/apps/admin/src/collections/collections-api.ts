import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateCollectionDocument,
  CollectionProductPickerDocument,
  OperatorCollectionDocument,
  OperatorCollectionsDocument,
  OperatorUpdateCollectionDocument,
  type CollectionProductPickerQueryVariables,
  type OperatorCollectionsQueryVariables,
  type ProductCollectionInput,
} from '../generated/collections-operations';

interface CollectionScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class CollectionsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<CollectionScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: CollectionScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: CollectionScope, variables: OperatorCollectionsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCollectionsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing collections');
      }
      return data.productCollections;
    } finally {
      client.stop();
    }
  }

  async products(scope: CollectionScope, variables: CollectionProductPickerQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: CollectionProductPickerDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing products for the collection picker');
      }
      return data.products;
    } finally {
      client.stop();
    }
  }

  async find(scope: CollectionScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCollectionDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing collection result');
      }
      return data.productCollection;
    } finally {
      client.stop();
    }
  }

  async save(
    scope: CollectionScope,
    input: ProductCollectionInput,
    id: string | null,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateCollectionDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateProductCollection.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateCollectionDocument,
          variables: { input },
        });
        if (data) {
          return data.createProductCollection.id;
        }
      }
      throw new Error('Missing saved collection');
    } finally {
      client.stop();
    }
  }
}
