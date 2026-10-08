import { SubmittedWrites } from '../../../core/graphql/submitted-writes';
import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  AdminEventsDocument,
  AdminEventDocument,
  AdminCreateEventDocument,
  AdminUpdateEventDocument,
  AdminSetEventsStatusDocument,
  AdminTrashEventsDocument,
  AdminRestoreEventsDocument,
  AdminEventHistoryDocument,
  AdminVenuesDocument,
  AdminTagsDocument,
  type AdminVenuesQueryVariables,
  type AdminTagsQueryVariables,
  type AdminEventsQueryVariables,
  type AdminCreateEventMutationVariables,
  type AdminUpdateEventMutationVariables,
  type AdminEventHistoryQueryVariables,
  type AdminSetEventsStatusMutation,
} from '../../../../generated/graphql/operations';

export type EventAction = 'publish' | 'archive' | 'trash' | 'restore';
export interface EventActionTarget {
  action: EventAction;
  ids: string[];
}

@Injectable()
export class EventsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly submittedWrites = inject(SubmittedWrites);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed) throw new Error('EventsApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(
        this.httpLink,
        this.config.graphqlUrl,
        { storeId, language },
        this.submittedWrites,
      ),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminEventsQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    return this.apollo.watchQuery({
      query: AdminEventsDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateEventMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateEventDocument, variables }),
      );
      if (!result.data?.updateReferenceEvent)
        throw new Error('Missing updateReferenceEvent result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceEvents' });
      return result.data.updateReferenceEvent;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchEvent(id: string, includeDeleted = false) {
    if (!this.apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    return this.apollo.watchQuery({
      query: AdminEventDocument,
      variables: { id, includeDeleted },
      fetchPolicy: 'network-only',
    });
  }

  watchHistory(variables: AdminEventHistoryQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    return this.apollo.watchQuery({
      query: AdminEventHistoryDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async applyAction(target: EventActionTarget) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    const ids = [...target.ids];
    if (!ids.length || ids.length > 100) throw new Error('Choose between 1 and 100 events.');
    this.pendingWrites++;
    try {
      let affected: AdminSetEventsStatusMutation['setReferenceEventsStatus'] | undefined;
      switch (target.action) {
        case 'publish':
        case 'archive': {
          const result = await firstValueFrom(
            apollo.mutate({
              mutation: AdminSetEventsStatusDocument,
              variables: { ids, status: target.action === 'publish' ? 'PUBLISHED' : 'ARCHIVED' },
            }),
          );
          affected = result.data?.setReferenceEventsStatus;
          break;
        }
        case 'trash': {
          const result = await firstValueFrom(
            apollo.mutate({ mutation: AdminTrashEventsDocument, variables: { ids } }),
          );
          affected = result.data?.trashReferenceEvents;
          break;
        }
        case 'restore': {
          const result = await firstValueFrom(
            apollo.mutate({ mutation: AdminRestoreEventsDocument, variables: { ids } }),
          );
          affected = result.data?.restoreReferenceEvents;
          break;
        }
      }
      if (!affected) throw new Error('Missing Event action result.');
      // All invalidation stays on the immutable client captured when the write was submitted.
      for (const fieldName of ['referenceEvents', 'referenceEvent', 'referenceEventHistory'])
        apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName });
      return affected;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async create(variables: AdminCreateEventMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateEventDocument, variables }),
      );
      if (!result.data?.createReferenceEvent)
        throw new Error('Missing createReferenceEvent result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceEvents' });
      return result.data.createReferenceEvent;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchVenues(variables: AdminVenuesQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    return this.apollo.watchQuery({
      query: AdminVenuesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchTags(variables: AdminTagsQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Events workspace is required.');
    return this.apollo.watchQuery({
      query: AdminTagsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
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
