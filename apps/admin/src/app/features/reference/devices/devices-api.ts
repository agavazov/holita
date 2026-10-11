import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom, map, filter } from 'rxjs';
import type { RelationRequest, RelationPage } from '../relation-picker';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  AdminDeviceVehiclesDocument,
  AdminDevicesDocument,
  AdminDeviceDocument,
  AdminCreateDeviceDocument,
  AdminUpdateDeviceDocument,
  AdminDeleteDeviceDocument,
  type AdminDevicesQueryVariables,
  type AdminCreateDeviceMutationVariables,
  type AdminUpdateDeviceMutationVariables,
  type AdminDeleteDeviceMutationVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class DevicesApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(storeId: string, language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('DevicesApi belongs to one store workspace.');
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, { storeId, language }),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch(variables: AdminDevicesQueryVariables) {
    if (!this.apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    return this.apollo.watchQuery({
      query: AdminDevicesDocument,
      variables,
    });
  }

  vehicles(request: RelationRequest) {
    if (!this.apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    return this.apollo
      .watchQuery({
        query: AdminDeviceVehiclesDocument,
        variables: { offset: request.offset, limit: 20, search: request.search, ids: request.ids },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result): RelationPage | null => {
          if (result.error)
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          if (result.dataState !== 'complete') return null;
          return {
            items: result.data.referenceVehicles.items.map((vehicle) => ({
              id: vehicle.id,
              name: vehicle.licensePlate,
              active: true,
            })),
            total: result.data.referenceVehicles.total,
          };
        }),
        filter((page): page is RelationPage => page !== null),
      );
  }

  async update(variables: AdminUpdateDeviceMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateDeviceDocument, variables }),
      );
      if (!result.data?.updateReferenceDevice)
        throw new Error('Missing updateReferenceDevice result.');
      // Invalidation belongs to the client captured at submission, including after navigation.
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceDevices' });
      return result.data.updateReferenceDevice;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchDevice(id: string) {
    if (!this.apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    return this.apollo.watchQuery({
      query: AdminDeviceDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateDeviceMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateDeviceDocument, variables }),
      );
      if (!result.data?.createReferenceDevice)
        throw new Error('Missing createReferenceDevice result.');
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'referenceDevices' });
      return result.data.createReferenceDevice;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async delete(variables: AdminDeleteDeviceMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) throw new Error('An active Devices workspace is required.');
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteDeviceDocument, variables }),
      );
      const device = result.data?.deleteReferenceDevice;
      if (!device) throw new Error('Missing deleteReferenceDevice result.');
      // Reconcile the visible list once per batch; invalidate every list variant in this client only.
      const entity = apollo.client.cache.identify(device);
      if (entity) apollo.client.cache.evict({ id: entity, broadcast: false });
      apollo.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'referenceDevices',
        broadcast: false,
      });
      return device;
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
