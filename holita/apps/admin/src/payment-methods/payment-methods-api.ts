import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreatePaymentMethodDocument,
  OperatorPaymentMethodDocument,
  OperatorPaymentMethodsDocument,
  OperatorUpdatePaymentMethodDocument,
  type OperatorPaymentMethodsQueryVariables,
  type PaymentMethodInput,
} from '../generated/payment-methods-operations';

interface PaymentMethodScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentMethodsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<PaymentMethodScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: PaymentMethodScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: PaymentMethodScope, variables: OperatorPaymentMethodsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorPaymentMethodsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing payment methods');
      }
      return data.paymentMethods;
    } finally {
      client.stop();
    }
  }

  async find(scope: PaymentMethodScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorPaymentMethodDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing payment method result');
      }
      return data.paymentMethod;
    } finally {
      client.stop();
    }
  }

  async save(
    scope: PaymentMethodScope,
    input: PaymentMethodInput,
    id: string | null,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdatePaymentMethodDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updatePaymentMethod.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreatePaymentMethodDocument,
          variables: { input },
        });
        if (data) {
          return data.createPaymentMethod.id;
        }
      }
      throw new Error('Missing saved payment method');
    } finally {
      client.stop();
    }
  }
}
