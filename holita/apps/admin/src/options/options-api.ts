import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateOptionDocument,
  OperatorOptionDocument,
  OperatorOptionsDocument,
  OperatorUpdateOptionDocument,
  type OperatorOptionsQueryVariables,
  type OptionInput,
} from '../generated/options-operations';

interface OptionScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class OptionsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<OptionScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: OptionScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: OptionScope, variables: OperatorOptionsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOptionsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing options');
      }
      return data.options;
    } finally {
      client.stop();
    }
  }

  async find(scope: OptionScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOptionDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing option result');
      }
      return data.option;
    } finally {
      client.stop();
    }
  }

  async save(scope: OptionScope, input: OptionInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateOptionDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateOption.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateOptionDocument,
          variables: { input },
        });
        if (data) {
          return data.createOption.id;
        }
      }
      throw new Error('Missing saved option');
    } finally {
      client.stop();
    }
  }
}
