import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCategoriesDocument,
  OperatorCategoryDocument,
  OperatorCreateCategoryDocument,
  OperatorDeleteCategoryDocument,
  OperatorUpdateCategoryDocument,
  type CategoryInput,
} from '../generated/categories-operations';

interface CategoryScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<CategoryScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: CategoryScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: CategoryScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCategoriesDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing categories');
      }
      return data.categories;
    } finally {
      client.stop();
    }
  }

  async find(scope: CategoryScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCategoryDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing category result');
      }
      return data.category;
    } finally {
      client.stop();
    }
  }

  async save(scope: CategoryScope, input: CategoryInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateCategoryDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateCategory.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateCategoryDocument,
          variables: { input },
        });
        if (data) {
          return data.createCategory.id;
        }
      }
      throw new Error('Missing saved category');
    } finally {
      client.stop();
    }
  }

  async delete(scope: CategoryScope, id: string): Promise<void> {
    const client = this.client(scope);
    try {
      await client.mutate({ mutation: OperatorDeleteCategoryDocument, variables: { id } });
    } finally {
      client.stop();
    }
  }
}
