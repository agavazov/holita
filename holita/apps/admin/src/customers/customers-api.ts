import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateCustomerAddressDocument,
  OperatorCustomerDocument,
  OperatorCustomerOrdersDocument,
  OperatorCustomersDocument,
  OperatorUpdateCustomerAddressDocument,
  OperatorUpdateCustomerContactDocument,
  type CustomerAddressInput,
  type CustomerContactInput,
  type OperatorCustomerOrdersQueryVariables,
  type OperatorCustomersQueryVariables,
} from '../generated/customers-operations';

interface CustomersScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  private readonly token = computed(() => this.session.current()?.token);
  readonly scope = computed<CustomersScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });
  readonly canWrite = computed(() => {
    const role = this.session.role();
    return !!this.scope() && (role === 'OPERATOR' || role === 'ADMINISTRATOR');
  });

  private client(scope: CustomersScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: CustomersScope, variables: OperatorCustomersQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCustomersDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing customers result');
      }
      return data.customers;
    } finally {
      client.stop();
    }
  }

  async find(scope: CustomersScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCustomerDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing customer result');
      }
      return data.customer;
    } finally {
      client.stop();
    }
  }

  async orders(scope: CustomersScope, variables: OperatorCustomerOrdersQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCustomerOrdersDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing customer orders result');
      }
      return data.orders;
    } finally {
      client.stop();
    }
  }

  async updateContact(scope: CustomersScope, id: string, input: CustomerContactInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateCustomerContactDocument,
        variables: { id, input },
      });
      if (!data) {
        throw new Error('Missing saved customer contact');
      }
      return data.updateCustomerContact.id;
    } finally {
      client.stop();
    }
  }

  async saveAddress(
    scope: CustomersScope,
    customerId: string,
    addressId: string | null,
    input: CustomerAddressInput,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (addressId) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateCustomerAddressDocument,
          variables: { customerId, addressId, input },
        });
        if (data) {
          return data.updateCustomerAddress.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateCustomerAddressDocument,
          variables: { customerId, input },
        });
        if (data) {
          return data.createCustomerAddress.id;
        }
      }
      throw new Error('Missing saved customer address');
    } finally {
      client.stop();
    }
  }
}
