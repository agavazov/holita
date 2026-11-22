import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateShippingMethodDocument,
  OperatorShippingMethodDocument,
  OperatorShippingMethodsDocument,
  OperatorUpdateShippingMethodDocument,
  type OperatorShippingMethodsQueryVariables,
  type ShippingMethodInput,
} from '../generated/shipping-methods-operations';

export const shippingFeeCurrency = 'BGN';

interface ShippingMethodScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class ShippingMethodsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<ShippingMethodScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: ShippingMethodScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: ShippingMethodScope, variables: OperatorShippingMethodsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorShippingMethodsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shipping methods');
      }
      return data.shippingMethods;
    } finally {
      client.stop();
    }
  }

  async find(scope: ShippingMethodScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorShippingMethodDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shipping method result');
      }
      return data.shippingMethod;
    } finally {
      client.stop();
    }
  }

  async save(
    scope: ShippingMethodScope,
    input: ShippingMethodInput,
    id: string | null,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateShippingMethodDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateShippingMethod.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateShippingMethodDocument,
          variables: { input },
        });
        if (data) {
          return data.createShippingMethod.id;
        }
      }
      throw new Error('Missing saved shipping method');
    } finally {
      client.stop();
    }
  }
}
