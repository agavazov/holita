import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  AdminVehiclesDocument,
  AdminVehicleDocument,
  AdminCreateVehicleDocument,
  AdminUpdateVehicleDocument,
  AdminVehicleSummaryDocument,
  AdminVehicleGroupsDocument,
  AdminVehicleDriversDocument,
  AdminDeleteVehiclesDocument,
  AdminDeactivateVehiclesDocument,
  type AdminVehiclesQueryVariables,
  type AdminCreateVehicleMutationVariables,
  type AdminUpdateVehicleMutationVariables,
  type AdminVehicleGroupsQueryVariables,
  type AdminVehicleDriversQueryVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class VehiclesApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('VehiclesApi belongs to one branch workspace.');
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

  watch(variables: AdminVehiclesQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehiclesDocument,
      variables,
    });
  }

  watchSummary() {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    return this.apollo.watchQuery({ query: AdminVehicleSummaryDocument });
  }

  watchGroups(variables: AdminVehicleGroupsQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehicleGroupsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchDrivers(variables: AdminVehicleDriversQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehicleDriversDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async update(variables: AdminUpdateVehicleMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateVehicleDocument, variables }),
      );
      if (!result.data?.updateFleetVehicle) {
        throw new Error('Missing updateFleetVehicle result.');
      }
      // Invalidation belongs to the client captured at submission, including after navigation.
      this.invalidateVehicles(apollo);
      return result.data.updateFleetVehicle;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchVehicle(id: string) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehicleDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateVehicleMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateVehicleDocument, variables }),
      );
      if (!result.data?.createFleetVehicle) {
        throw new Error('Missing createFleetVehicle result.');
      }
      this.invalidateVehicles(apollo);
      return result.data.createFleetVehicle;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async deleteMany(ids: readonly string[]) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteVehiclesDocument, variables: { ids: [...ids] } }),
      );
      const action = result.data?.deleteFleetVehicles;
      if (!action) {
        throw new Error('Missing deleteFleetVehicles result.');
      }
      if (action.succeededIds.length) {
        for (const id of action.succeededIds) {
          const entity = apollo.client.cache.identify({ __typename: 'FleetVehicle', id });
          if (entity) {
            apollo.client.cache.evict({ id: entity, broadcast: false });
          }
        }
        this.invalidateVehicles(apollo, false);
      }
      return action;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async deactivateMany(ids: readonly string[]) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicles workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeactivateVehiclesDocument, variables: { ids: [...ids] } }),
      );
      const action = result.data?.deactivateFleetVehicles;
      if (!action) {
        throw new Error('Missing deactivateFleetVehicles result.');
      }
      if (action.succeededIds.length) {
        this.invalidateVehicles(apollo, false);
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

  private invalidateVehicles(apollo: ApolloBase, broadcast = true): void {
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetVehicles', broadcast });
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetVehicleSummary', broadcast });
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
