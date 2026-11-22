import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  OperatorCreateProductDocument,
  OperatorProductDocument,
  OperatorProductOptionsDocument,
  OperatorProductsDocument,
  OperatorUpdateProductDocument,
  type OperatorProductsQueryVariables,
  type ProductInput,
} from '../generated/products-operations';

interface ProductScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly http = inject(HttpClient);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<ProductScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: ProductScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: ProductScope, variables: OperatorProductsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorProductsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing products');
      }
      return data.products;
    } finally {
      client.stop();
    }
  }

  async find(scope: ProductScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorProductDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing product result');
      }
      return data.product;
    } finally {
      client.stop();
    }
  }

  async options(scope: ProductScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorProductOptionsDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing product options');
      }
      return data.productOptions;
    } finally {
      client.stop();
    }
  }

  image(scope: ProductScope, url: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(url, {
        headers: { Authorization: `Bearer ${scope.token}` },
        responseType: 'blob',
      }),
    );
  }

  async save(scope: ProductScope, input: ProductInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateProductDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateProduct.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateProductDocument,
          variables: { input },
        });
        if (data) {
          return data.createProduct.id;
        }
      }
      throw new Error('Missing saved product');
    } finally {
      client.stop();
    }
  }
}
