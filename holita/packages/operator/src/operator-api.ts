import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import {
  OperatorCreateBranchDocument,
  OperatorCreateMerchantDocument,
  OperatorCreateProductDocument,
  OperatorCustomersDocument,
  OperatorMerchantsDocument,
  OperatorProductsDocument,
  OperatorSetBranchStatusDocument,
  OperatorSetMerchantStatusDocument,
  OperatorUpdateProductDocument,
  type AccountStatus,
  type OperatorCreateMerchantMutationVariables,
  type OperatorMerchantsQuery,
  type OperatorProductsQuery,
  type ProductInput,
  type ProductSort,
  type ProductFilter,
} from './generated/operations';

@Injectable({ providedIn: 'root' })
export class OperatorApi {
  private readonly session = inject(DemoSession);
  private readonly http = inject(HttpLink);
  private readonly config = inject(OperatorConfig);

  private client(language: Language, branchId?: string): ApolloClient {
    const scope = branchId ? { branchId, language } : undefined;
    return new ApolloClient(
      graphqlOptions(this.http, this.config.graphqlUrl, scope, this.session.capture()),
    );
  }

  async merchants(language: Language): Promise<OperatorMerchantsQuery['merchants']> {
    const client = this.client(language);
    try {
      const response = await client.query({
        query: OperatorMerchantsDocument,
        fetchPolicy: 'network-only',
      });
      if (!response.data) {
        throw new Error('Missing merchants');
      }
      return response.data.merchants;
    } finally {
      client.stop();
    }
  }

  async createMerchant(
    language: Language,
    variables: OperatorCreateMerchantMutationVariables,
  ): Promise<void> {
    const client = this.client(language);
    try {
      await client.mutate({ mutation: OperatorCreateMerchantDocument, variables });
    } finally {
      client.stop();
    }
  }

  async setMerchantStatus(
    language: Language,
    tenantId: string,
    status: AccountStatus,
  ): Promise<void> {
    const client = this.client(language);
    try {
      await client.mutate({
        mutation: OperatorSetMerchantStatusDocument,
        variables: { tenantId, status },
      });
    } finally {
      client.stop();
    }
  }

  async createBranch(language: Language, tenantId: string, name: string): Promise<void> {
    const client = this.client(language);
    try {
      await client.mutate({
        mutation: OperatorCreateBranchDocument,
        variables: { tenantId, name },
      });
    } finally {
      client.stop();
    }
  }

  async setBranchStatus(
    language: Language,
    tenantId: string,
    branchId: string,
    status: AccountStatus,
  ): Promise<void> {
    const client = this.client(language);
    try {
      await client.mutate({
        mutation: OperatorSetBranchStatusDocument,
        variables: { tenantId, branchId, status },
      });
    } finally {
      client.stop();
    }
  }

  async products(
    language: Language,
    branchId: string,
    offset: number,
    limit: number,
    search: string,
    sort: ProductSort,
    filter: ProductFilter | null,
  ): Promise<OperatorProductsQuery['products']> {
    const client = this.client(language, branchId);
    try {
      const response = await client.query({
        query: OperatorProductsDocument,
        variables: { offset, limit, search, sort, filter },
        fetchPolicy: 'network-only',
      });
      if (!response.data) {
        throw new Error('Missing products');
      }
      return response.data.products;
    } finally {
      client.stop();
    }
  }

  async customers(language: Language, branchId: string) {
    const client = this.client(language, branchId);
    try {
      const response = await client.query({
        query: OperatorCustomersDocument,
        fetchPolicy: 'network-only',
      });
      if (!response.data) {
        throw new Error('Missing customers');
      }
      return response.data.customers;
    } finally {
      client.stop();
    }
  }

  async saveProduct(
    language: Language,
    branchId: string,
    input: ProductInput,
    id?: string,
  ): Promise<void> {
    const client = this.client(language, branchId);
    try {
      if (id) {
        await client.mutate({ mutation: OperatorUpdateProductDocument, variables: { id, input } });
      } else {
        await client.mutate({ mutation: OperatorCreateProductDocument, variables: { input } });
      }
    } finally {
      client.stop();
    }
  }
}
