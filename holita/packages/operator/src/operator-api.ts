import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import {
  OperatorCreateBranchDocument,
  OperatorCreateMerchantDocument,
  OperatorCustomersDocument,
  OperatorMerchantsDocument,
  OperatorSetBranchStatusDocument,
  OperatorSetMerchantStatusDocument,
  type AccountStatus,
  type OperatorCreateMerchantMutationVariables,
  type OperatorMerchantsQuery,
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
}
