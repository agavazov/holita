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
  AdminDeviceVehiclesDocument,
  AdminDevicesDocument,
  AdminDeviceDocument,
  AdminCreateDeviceDocument,
  AdminUpdateDeviceDocument,
  AdminDeleteDevicesDocument,
  AdminDeviceSummaryDocument,
  type AdminDevicesQueryVariables,
  type AdminCreateDeviceMutationVariables,
  type AdminUpdateDeviceMutationVariables,
  type AdminDeviceVehiclesQueryVariables,
} from '../../../../generated/graphql/operations';

@Injectable()
export class DevicesApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('DevicesApi belongs to one branch workspace.');
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

  watch(variables: AdminDevicesQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminDevicesDocument,
      variables,
    });
  }

  watchVehicles(variables: AdminDeviceVehiclesQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminDeviceVehiclesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchSummary() {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    return this.apollo.watchQuery({ query: AdminDeviceSummaryDocument });
  }

  async update(variables: AdminUpdateDeviceMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateDeviceDocument, variables }),
      );
      if (!result.data?.updateFleetDevice) {
        throw new Error('Missing updateFleetDevice result.');
      }
      // Invalidation belongs to the client captured at submission, including after navigation.
      this.invalidateDevices(apollo);
      return result.data.updateFleetDevice;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  watchDevice(id: string) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminDeviceDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  async create(variables: AdminCreateDeviceMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateDeviceDocument, variables }),
      );
      if (!result.data?.createFleetDevice) {
        throw new Error('Missing createFleetDevice result.');
      }
      this.invalidateDevices(apollo);
      return result.data.createFleetDevice;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  async deleteMany(ids: readonly string[]) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Devices workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminDeleteDevicesDocument, variables: { ids: [...ids] } }),
      );
      const action = result.data?.deleteFleetDevices;
      if (!action) {
        throw new Error('Missing deleteFleetDevices result.');
      }
      for (const id of action.succeededIds) {
        const entity = apollo.client.cache.identify({ __typename: 'FleetDevice', id });
        if (entity) {
          apollo.client.cache.evict({ id: entity, broadcast: false });
        }
      }
      if (action.succeededIds.length) {
        this.invalidateDevices(apollo, false);
      }
      return action;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  private invalidateDevices(apollo: ApolloBase, broadcast = true): void {
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetDevices', broadcast });
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetDeviceSummary', broadcast });
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
