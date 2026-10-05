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
  AdminUpdateProductDocument,
  type AdminUpdateProductMutationVariables,
} from '../../../generated/graphql/operations';

@Injectable()
export class ProductsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  watch(storeId: string, language: Language) {
    if (this.apollo || this.destroyed)
      throw new Error('ProductsApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, { storeId, language }),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
    return this.apollo.watchQuery({
      query: AdminProductsDocument,
      variables: { offset: 0, limit: 20 },
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
