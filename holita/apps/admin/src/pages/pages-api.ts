import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateShopPageDocument,
  OperatorShopPageDocument,
  OperatorShopPagesDocument,
  OperatorUpdateShopPageDocument,
  type OperatorShopPagesQueryVariables,
  type ShopPageInput,
} from '../generated/pages-operations';

interface PageScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class PagesApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<PageScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: PageScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: PageScope, variables: OperatorShopPagesQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorShopPagesDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shop pages');
      }
      return data.shopPages;
    } finally {
      client.stop();
    }
  }

  async find(scope: PageScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorShopPageDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shop page result');
      }
      return data.shopPage;
    } finally {
      client.stop();
    }
  }

  async save(scope: PageScope, input: ShopPageInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateShopPageDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateShopPage.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateShopPageDocument,
          variables: { input },
        });
        if (data) {
          return data.createShopPage.id;
        }
      }
      throw new Error('Missing saved shop page');
    } finally {
      client.stop();
    }
  }
}
