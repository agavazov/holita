import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminCreateVehicleGroupDocument,
  AdminDeleteVehicleGroupDocument,
  AdminUpdateVehicleGroupDocument,
  AdminVehicleGroupDocument,
  AdminVehicleGroupsListDocument,
  type AdminCreateVehicleGroupMutationVariables,
  type AdminDeleteVehicleGroupMutationVariables,
  type AdminUpdateVehicleGroupMutationVariables,
  type AdminVehicleGroupsListQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One captured session, Branch and language for a mounted list or editor. */
@Injectable()
export class VehicleGroupsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('VehicleGroupsApi belongs to one Branch workspace.');
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

  watch(variables: AdminVehicleGroupsListQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicle groups workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehicleGroupsListDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchGroup(id: string) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicle groups workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminVehicleGroupDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateVehicleGroupMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicle groups workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateVehicleGroupDocument, variables }),
      );
      if (!result.data?.createFleetVehicleGroup) {
        throw new Error('Missing createFleetVehicleGroup result.');
      }
      this.invalidate(apollo);
      return result.data.createFleetVehicleGroup;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async update(variables: AdminUpdateVehicleGroupMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicle groups workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateVehicleGroupDocument, variables }),
      );
      if (!result.data?.updateFleetVehicleGroup) {
        throw new Error('Missing updateFleetVehicleGroup result.');
      }
      this.invalidate(apollo);
      return result.data.updateFleetVehicleGroup;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteVehicleGroupMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Vehicle groups workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteVehicleGroupDocument, variables }),
      );
      if (!result.data?.deleteFleetVehicleGroup) {
        throw new Error('Missing deleteFleetVehicleGroup result.');
      }
      const entity = apollo.client.cache.identify({
        __typename: 'FleetVehicleGroup',
        id: variables.id,
      });
      if (entity) {
        apollo.client.cache.evict({ id: entity, broadcast: false });
      }
      this.invalidate(apollo);
      return result.data.deleteFleetVehicleGroup;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private invalidate(apollo: ApolloBase): void {
    apollo.client.cache.evict({
      id: 'ROOT_QUERY',
      fieldName: 'fleetVehicleGroups',
      broadcast: false,
    });
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
