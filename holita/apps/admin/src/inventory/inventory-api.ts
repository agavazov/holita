import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorInventoryDocument,
  OperatorInventoryVariantDocument,
  OperatorUpdateInventoryQuantityDocument,
  type OperatorInventoryQueryVariables,
} from '../generated/inventory-operations';

interface InventoryScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<InventoryScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: InventoryScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: InventoryScope, variables: OperatorInventoryQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorInventoryDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing inventory');
      }
      return data.inventory;
    } finally {
      client.stop();
    }
  }

  async find(scope: InventoryScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorInventoryVariantDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing inventory variant result');
      }
      return data.inventoryVariant;
    } finally {
      client.stop();
    }
  }

  async save(scope: InventoryScope, id: string, quantity: number): Promise<string> {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateInventoryQuantityDocument,
        variables: { id, quantity },
      });
      if (!data) {
        throw new Error('Missing saved inventory quantity');
      }
      return data.updateInventoryQuantity.id;
    } finally {
      client.stop();
    }
  }
}
