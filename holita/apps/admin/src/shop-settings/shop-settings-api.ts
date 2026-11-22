import { Injectable, computed, inject } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorShopSettingsDocument,
  OperatorUpdateShopSettingsDocument,
  type ShopSettingsInput,
} from '../generated/shop-settings-operations';

interface ShopSettingsScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class ShopSettingsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<ShopSettingsScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: ShopSettingsScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async read(scope: ShopSettingsScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorShopSettingsDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shop settings');
      }
      return data.shopSettings;
    } finally {
      client.stop();
    }
  }

  async save(scope: ShopSettingsScope, input: ShopSettingsInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateShopSettingsDocument,
        variables: { input },
      });
      if (!data) {
        throw new Error('Missing saved shop settings');
      }
      return data.updateShopSettings;
    } finally {
      client.stop();
    }
  }
}
