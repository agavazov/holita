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
  AdminMediaDocument,
  AdminUploadIntentDocument,
  AdminFinalizeUploadDocument,
  AdminUpdateMediaDocument,
  AdminDeleteMediaDocument,
  AdminMediaCoverDocument,
  AdminReorderMediaDocument,
  type CreateReferenceUploadInput,
  type UpdateReferenceEventMediaInput,
} from '../../../../generated/graphql/operations';

@Injectable()
export class MediaApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly submittedWrites = inject(SubmittedWrites);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private eventId = '';
  private destroyed = false;
  private pendingWrites = 0;
  initialize(storeId: string, language: Language, eventId: string): void {
    if (this.apollo || this.destroyed) throw new Error('MediaApi belongs to one Event workspace.');
    this.eventId = eventId;
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(
          this.httpLink,
          this.config.graphqlUrl,
          { storeId, language },
          this.submittedWrites,
        ),
      ),
    );
  }
  watchList() {
    return this.activeClient().watchQuery({
      query: AdminMediaDocument,
      variables: { eventId: this.eventId },
      fetchPolicy: 'network-only',
      pollInterval: 8 * 60_000,
    });
  }
  async intent(input: CreateReferenceUploadInput) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminUploadIntentDocument,
          variables: { eventId: this.eventId, input: { ...input } },
        }),
      );
      if (!result.data?.createReferenceUploadIntent) throw new Error('Missing upload intent.');
      return result.data.createReferenceUploadIntent;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async finalize(uploadId: string) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminFinalizeUploadDocument, variables: { uploadId } }),
      );
      if (!result.data?.finalizeReferenceUpload) throw new Error('Missing finalized image.');
      this.invalidate(apollo);
      return result.data.finalizeReferenceUpload;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async update(id: string, input: UpdateReferenceEventMediaInput) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminUpdateMediaDocument,
          variables: { eventId: this.eventId, id, input: { ...input } },
        }),
      );
      if (!result.data?.updateReferenceEventMedia) throw new Error('Missing updated image.');
      this.invalidate(apollo);
      return result.data.updateReferenceEventMedia;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async delete(id: string) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminDeleteMediaDocument,
          variables: { eventId: this.eventId, id },
        }),
      );
      if (!result.data?.deleteReferenceEventMedia) throw new Error('Missing deleted image.');
      this.invalidate(apollo);
      return result.data.deleteReferenceEventMedia;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async cover(id: string) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminMediaCoverDocument,
          variables: { eventId: this.eventId, id },
        }),
      );
      if (!result.data?.setReferenceEventCover) throw new Error('Missing cover result.');
      this.invalidate(apollo);
      return result.data.setReferenceEventCover;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async reorder(ids: string[]) {
    const apollo = this.activeClient();
    const variables = { eventId: this.eventId, ids: [...ids] };
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminReorderMediaDocument, variables }),
      );
      if (!result.data?.reorderReferenceEventMedia) throw new Error('Missing gallery order.');
      this.invalidate(apollo);
      return result.data.reorderReferenceEventMedia;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  private activeClient(): ApolloBase {
    if (!this.apollo || this.destroyed) throw new Error('An active Media workspace is required.');
    return this.apollo;
  }
  private invalidate(apollo: ApolloBase): void {
    // Writes invalidate only their captured client, including after its workspace retires.
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceEventMedia' });
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
