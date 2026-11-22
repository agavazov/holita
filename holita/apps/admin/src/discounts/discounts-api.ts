import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateDiscountDocument,
  OperatorDiscountDocument,
  OperatorDiscountsDocument,
  OperatorUpdateDiscountDocument,
  type OperatorDiscountsQueryVariables,
  type DiscountInput,
} from '../generated/discounts-operations';

interface DiscountScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class DiscountsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<DiscountScope | null>(() => {
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

  private client(scope: DiscountScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: DiscountScope, variables: OperatorDiscountsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorDiscountsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing discounts');
      }
      return data.discounts;
    } finally {
      client.stop();
    }
  }

  async find(scope: DiscountScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorDiscountDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing discount result');
      }
      return data.discount;
    } finally {
      client.stop();
    }
  }

  async save(scope: DiscountScope, input: DiscountInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateDiscountDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateDiscount.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateDiscountDocument,
          variables: { input },
        });
        if (data) {
          return data.createDiscount.id;
        }
      }
      throw new Error('Missing saved discount');
    } finally {
      client.stop();
    }
  }
}
