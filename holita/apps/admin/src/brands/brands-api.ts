import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  OperatorBrandDocument,
  OperatorBrandsDocument,
  OperatorCreateBrandDocument,
  OperatorDeleteBrandDocument,
  OperatorUpdateBrandDocument,
  type BrandInput,
  type OperatorBrandsQueryVariables,
} from '../generated/brands-operations';

interface BrandScope {
  readonly branchId: string;
  readonly language: Language;
  readonly tenantId: string;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class BrandsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly http = inject(HttpClient);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<BrandScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { branchId, language, tenantId, token } : null;
  });

  private client(scope: BrandScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: BrandScope, variables: OperatorBrandsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBrandsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing brands');
      }
      return data.brands;
    } finally {
      client.stop();
    }
  }

  async options(scope: BrandScope, abort: AbortSignal) {
    const options: { id: string; name: string }[] = [];
    let total = 1;
    while (options.length < total) {
      abort.throwIfAborted();
      const page = await this.list(scope, { offset: options.length, limit: 100 });
      if (!page.items.length) {
        break;
      }
      options.push(...page.items.map(({ id, name }) => ({ id, name })));
      total = page.total;
    }
    return options;
  }

  async find(scope: BrandScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBrandDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing brand result');
      }
      return data.brand;
    } finally {
      client.stop();
    }
  }

  logo(scope: BrandScope, url: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(url, {
        headers: { Authorization: `Bearer ${scope.token}` },
        responseType: 'blob',
      }),
    );
  }

  async save(scope: BrandScope, input: BrandInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const result = await client.mutate({
          mutation: OperatorUpdateBrandDocument,
          variables: { id, input },
        });
        if (result.data) {
          return result.data.updateBrand.id;
        }
      } else {
        const result = await client.mutate({
          mutation: OperatorCreateBrandDocument,
          variables: { input },
        });
        if (result.data) {
          return result.data.createBrand.id;
        }
      }
      throw new Error('Missing saved brand');
    } finally {
      client.stop();
    }
  }

  async delete(scope: BrandScope, id: string): Promise<void> {
    const client = this.client(scope);
    try {
      await client.mutate({ mutation: OperatorDeleteBrandDocument, variables: { id } });
    } finally {
      client.stop();
    }
  }
}
