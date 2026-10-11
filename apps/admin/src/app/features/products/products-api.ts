import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';
import {
  AdminProductsDocument,
  AdminProductDocument,
  AdminCreateProductDocument,
  AdminUpdateProductDocument,
  AdminDeleteProductDocument,
  type AdminProductsQueryVariables,
  type AdminCreateProductMutationVariables,
  type AdminUpdateProductMutationVariables,
  type AdminDeleteProductMutationVariables,
} from '../../../generated/graphql/operations';

@Injectable()
export class ProductsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('ProductsApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, { storeId, language }),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminProductsQueryVariables) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Products workspace is required.');
    return this.apollo.watchQuery({
      query: AdminProductsDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateProductMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Products workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateProductDocument, variables }),
      );
      if (!result.data?.updateProduct) throw new Error('Missing updateProduct result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'products' });
      return result.data.updateProduct;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchProduct(id: string) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Products workspace is required.');
    return this.apollo.watchQuery({
      query: AdminProductDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateProductMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Products workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateProductDocument, variables }),
      );
      if (!result.data?.createProduct) throw new Error('Missing createProduct result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'products' });
      return result.data.createProduct;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteProductMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Products workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteProductDocument, variables }),
      );
      const product = result.data?.deleteProduct;
      if (!product) throw new Error('Missing deleteProduct result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(product);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'products', broadcast: false });
      return product;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
