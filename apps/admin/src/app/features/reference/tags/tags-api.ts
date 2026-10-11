import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  AdminTagsDocument,
  AdminTagDocument,
  AdminCreateTagDocument,
  AdminUpdateTagDocument,
  AdminDeleteTagDocument,
  type AdminTagsQueryVariables,
  type AdminCreateTagMutationVariables,
  type AdminUpdateTagMutationVariables,
  type AdminDeleteTagMutationVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class TagsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed) throw new Error('TagsApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, { storeId, language }),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminTagsQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Tags workspace is required.');
    return this.apollo.watchQuery({
      query: AdminTagsDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateTagMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Tags workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateTagDocument, variables }),
      );
      if (!result.data?.updateReferenceTag) throw new Error('Missing updateReferenceTag result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceTags' });
      return result.data.updateReferenceTag;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchTag(id: string) {
    if (!this.apollo || this.destroyed) throw new Error('An active Tags workspace is required.');
    return this.apollo.watchQuery({
      query: AdminTagDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateTagMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Tags workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateTagDocument, variables }),
      );
      if (!result.data?.createReferenceTag) throw new Error('Missing createReferenceTag result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceTags' });
      return result.data.createReferenceTag;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteTagMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Tags workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteTagDocument, variables }),
      );
      const tag = result.data?.deleteReferenceTag;
      if (!tag) throw new Error('Missing deleteReferenceTag result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(tag);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'referenceTags',
        broadcast: false,
      });
      return tag;
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
