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
  AdminDeleteVehicleDocument,
  type AdminVehiclesQueryVariables,
  type AdminCreateVehicleMutationVariables,
  type AdminUpdateVehicleMutationVariables,
  type AdminDeleteVehicleMutationVariables,
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

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('VehiclesApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(
        this.httpLink,
        this.config.graphqlUrl,
        { storeId, language },
        this.session.capture(),
      ),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminVehiclesQueryVariables) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Vehicles workspace is required.');
    return this.apollo.watchQuery({
      query: AdminVehiclesDocument,
      variables,
    });
  }

  async update(variables: AdminUpdateVehicleMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Vehicles workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateVehicleDocument, variables }),
      );
      if (!result.data?.updateFleetVehicle) throw new Error('Missing updateFleetVehicle result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetVehicles' });
      return result.data.updateFleetVehicle;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchVehicle(id: string) {
    if (!this.apollo || this.destroyed)
      throw new Error('An active Vehicles workspace is required.');
    return this.apollo.watchQuery({
      query: AdminVehicleDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateVehicleMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Vehicles workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateVehicleDocument, variables }),
      );
      if (!result.data?.createFleetVehicle) throw new Error('Missing createFleetVehicle result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetVehicles' });
      return result.data.createFleetVehicle;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteVehicleMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Vehicles workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteVehicleDocument, variables }),
      );
      const vehicle = result.data?.deleteFleetVehicle;
      if (!vehicle) throw new Error('Missing deleteFleetVehicle result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(vehicle);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'fleetVehicles',
        broadcast: false,
      });
      return vehicle;
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
