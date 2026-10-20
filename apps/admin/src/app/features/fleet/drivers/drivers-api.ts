import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminCreateDriverDocument,
  AdminDeactivateDriversDocument,
  AdminDeleteDriversDocument,
  AdminDriverDocument,
  AdminDriverContextDocument,
  AdminDriverScorecardDocument,
  AdminDriversDocument,
  AdminDriverSummaryDocument,
  AdminUpdateDriverDocument,
  type AdminCreateDriverMutationVariables,
  type AdminDriverScorecardQueryVariables,
  type AdminDriversQueryVariables,
  type AdminUpdateDriverMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One captured session, Branch and language per list, drawer or scorecard workspace. */
@Injectable()
export class DriversApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('DriversApi belongs to one branch workspace.');
    }
    const client = new ApolloClient(
      graphqlOptions(
        this.httpLink,
        this.config.graphqlUrl,
        { branchId, language },
        this.session.capture(),
      ),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminDriversQueryVariables) {
    return this.active().watchQuery({ query: AdminDriversDocument, variables });
  }

  watchSummary() {
    return this.active().watchQuery({ query: AdminDriverSummaryDocument });
  }

  watchDriver(id: string) {
    return this.active().watchQuery({
      query: AdminDriverDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  watchContext() {
    return this.active().watchQuery({
      query: AdminDriverContextDocument,
      fetchPolicy: 'network-only',
    });
  }

  watchScorecard(variables: AdminDriverScorecardQueryVariables) {
    return this.active().watchQuery({
      query: AdminDriverScorecardDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateDriverMutationVariables) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateDriverDocument, variables }),
      );
      if (!result.data?.createFleetDriver) {
        throw new Error('Missing createFleetDriver result.');
      }
      this.invalidate(apollo);
      return result.data.createFleetDriver;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async update(variables: AdminUpdateDriverMutationVariables) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateDriverDocument, variables }),
      );
      if (!result.data?.updateFleetDriver) {
        throw new Error('Missing updateFleetDriver result.');
      }
      this.invalidate(apollo);
      return result.data.updateFleetDriver;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async deleteMany(ids: readonly string[]) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminDeleteDriversDocument,
          variables: { ids: [...ids] },
        }),
      );
      const action = result.data?.deleteFleetDrivers;
      if (!action) {
        throw new Error('Missing deleteFleetDrivers result.');
      }
      if (action.succeededIds.length) {
        for (const id of action.succeededIds) {
          const entity = apollo.client.cache.identify({ __typename: 'FleetDriver', id });
          if (entity) {
            apollo.client.cache.evict({ id: entity, broadcast: false });
          }
        }
        this.invalidate(apollo, false);
      }
      return action;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async deactivateMany(ids: readonly string[]) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminDeactivateDriversDocument,
          variables: { ids: [...ids] },
        }),
      );
      const action = result.data?.deactivateFleetDrivers;
      if (!action) {
        throw new Error('Missing deactivateFleetDrivers result.');
      }
      if (action.succeededIds.length) {
        this.invalidate(apollo, false);
      }
      return action;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private active(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Drivers workspace is required.');
    }
    return this.apollo;
  }

  private invalidate(apollo: ApolloBase, broadcast = true): void {
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetDrivers', broadcast });
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetDriverSummary', broadcast });
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetDriverScorecard', broadcast });
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
