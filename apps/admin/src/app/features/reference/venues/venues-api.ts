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
  AdminVenuesDocument,
  AdminVenueDocument,
  AdminCreateVenueDocument,
  AdminUpdateVenueDocument,
  AdminDeleteVenueDocument,
  type AdminVenuesQueryVariables,
  type AdminCreateVenueMutationVariables,
  type AdminUpdateVenueMutationVariables,
  type AdminDeleteVenueMutationVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class VenuesApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly submittedWrites = inject(SubmittedWrites);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed) throw new Error('VenuesApi belongs to one store workspace.');
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

  watch(variables: AdminVenuesQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Venues workspace is required.');
    return this.apollo.watchQuery({
      query: AdminVenuesDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateVenueMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Venues workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateVenueDocument, variables }),
      );
      if (!result.data?.updateReferenceVenue)
        throw new Error('Missing updateReferenceVenue result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceVenues' });
      return result.data.updateReferenceVenue;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchVenue(id: string) {
    if (!this.apollo || this.destroyed) throw new Error('An active Venues workspace is required.');
    return this.apollo.watchQuery({
      query: AdminVenueDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateVenueMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Venues workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateVenueDocument, variables }),
      );
      if (!result.data?.createReferenceVenue)
        throw new Error('Missing createReferenceVenue result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceVenues' });
      return result.data.createReferenceVenue;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteVenueMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Venues workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteVenueDocument, variables }),
      );
      const venue = result.data?.deleteReferenceVenue;
      if (!venue) throw new Error('Missing deleteReferenceVenue result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(venue);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'referenceVenues',
        broadcast: false,
      });
      return venue;
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
