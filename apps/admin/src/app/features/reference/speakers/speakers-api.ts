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
  AdminSpeakersDocument,
  AdminSpeakerDocument,
  AdminCreateSpeakerDocument,
  AdminUpdateSpeakerDocument,
  AdminDeleteSpeakerDocument,
  type AdminSpeakersQueryVariables,
  type AdminCreateSpeakerMutationVariables,
  type AdminUpdateSpeakerMutationVariables,
  type AdminDeleteSpeakerMutationVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class SpeakersApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly submittedWrites = inject(SubmittedWrites);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('SpeakersApi belongs to one store workspace.');
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

  watch(variables: AdminSpeakersQueryVariables) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Speakers workspace is required.');
    return this.apollo.watchQuery({
      query: AdminSpeakersDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateSpeakerMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Speakers workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateSpeakerDocument, variables }),
      );
      if (!result.data?.updateReferenceSpeaker)
        throw new Error('Missing updateReferenceSpeaker result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceSpeakers' });
      return result.data.updateReferenceSpeaker;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchSpeaker(id: string) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Speakers workspace is required.');
    return this.apollo.watchQuery({
      query: AdminSpeakerDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateSpeakerMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Speakers workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateSpeakerDocument, variables }),
      );
      if (!result.data?.createReferenceSpeaker)
        throw new Error('Missing createReferenceSpeaker result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceSpeakers' });
      return result.data.createReferenceSpeaker;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteSpeakerMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Speakers workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteSpeakerDocument, variables }),
      );
      const speaker = result.data?.deleteReferenceSpeaker;
      if (!speaker) throw new Error('Missing deleteReferenceSpeaker result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(speaker);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'referenceSpeakers',
        broadcast: false,
      });
      return speaker;
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
