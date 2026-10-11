import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom, Subject } from 'rxjs';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  AdminSessionsDocument,
  AdminSessionDocument,
  AdminEventDocument,
  AdminSpeakersDocument,
  AdminCreateSessionDocument,
  AdminUpdateSessionDocument,
  AdminDeleteSessionDocument,
  AdminReorderSessionsDocument,
  type CreateReferenceSessionInput,
  type UpdateReferenceSessionInput,
  type AdminSpeakersQueryVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class SessionsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private eventId = '';
  private destroyed = false;
  private pendingWrites = 0;
  private readonly writes = new Subject<void>();
  readonly savedChanges = this.writes.asObservable();
  initialize(storeId: string, language: Language, eventId: string): void {
    if (this.apollo || this.destroyed)
      throw new Error('SessionsApi belongs to one Event workspace.');
    this.eventId = eventId;
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, { storeId, language }),
      ),
    );
  }
  watchList() {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Sessions workspace is required.');
    return this.apollo.watchQuery({
      query: AdminSessionsDocument,
      variables: { eventId: this.eventId },
      fetchPolicy: 'network-only',
    });
  }
  watchSession(id: string) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Sessions workspace is required.');
    return this.apollo.watchQuery({
      query: AdminSessionDocument,
      variables: { eventId: this.eventId, id },
      fetchPolicy: 'network-only',
    });
  }
  watchEvent() {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Sessions workspace is required.');
    return this.apollo.watchQuery({
      query: AdminEventDocument,
      variables: { id: this.eventId },
      fetchPolicy: 'network-only',
    });
  }
  watchSpeakers(variables: AdminSpeakersQueryVariables) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Sessions workspace is required.');
    return this.apollo.watchQuery({
      query: AdminSpeakersDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  async create(input: CreateReferenceSessionInput) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Sessions workspace is required.');
    const variables = {
      eventId: this.eventId,
      input: { ...input, speakerIds: [...(input.speakerIds ?? [])] },
    };
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateSessionDocument, variables }),
      );
      if (!result.data?.createReferenceSession)
        throw new Error('Missing createReferenceSession result.');
      this.invalidate(apollo);
      return result.data.createReferenceSession;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async update(id: string, input: UpdateReferenceSessionInput) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Sessions workspace is required.');
    const variables = {
      eventId: this.eventId,
      id,
      input: { ...input, ...(input.speakerIds ? { speakerIds: [...input.speakerIds] } : {}) },
    };
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateSessionDocument, variables }),
      );
      if (!result.data?.updateReferenceSession)
        throw new Error('Missing updateReferenceSession result.');
      this.invalidate(apollo);
      return result.data.updateReferenceSession;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async delete(id: string) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Sessions workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminDeleteSessionDocument,
          variables: { eventId: this.eventId, id },
        }),
      );
      if (!result.data?.deleteReferenceSession)
        throw new Error('Missing deleteReferenceSession result.');
      this.invalidate(apollo);
      return result.data.deleteReferenceSession;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async reorder(ids: string[]) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Sessions workspace is required.');
    const variables = { eventId: this.eventId, ids: [...ids] };
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminReorderSessionsDocument, variables }),
      );
      if (!result.data?.reorderReferenceSessions)
        throw new Error('Missing reorderReferenceSessions result.');
      this.invalidate(apollo);
      return result.data.reorderReferenceSessions;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  private invalidate(apollo: ApolloBase): void {
    // Writes invalidate only their captured client, including after its workspace retires.
    for (const fieldName of [
      'referenceSessions',
      'referenceSession',
      'referenceEvent',
      'referenceEvents',
      'referenceEventHistory',
    ])
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName });
    this.writes.next();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.writes.complete();
    this.stopWhenIdle();
  }
  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
