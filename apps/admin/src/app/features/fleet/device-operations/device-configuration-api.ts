import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminDeviceConfigurationPageDocument,
  AdminDeviceConfigurationTargetsDocument,
  AdminRequestDeviceConfigurationReadDocument,
  AdminRequestDeviceParameterAdditionDocument,
  AdminRequestDeviceParameterIntervalUpdateDocument,
  type AdminRequestDeviceConfigurationReadMutationVariables,
  type AdminRequestDeviceParameterAdditionMutationVariables,
  type AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One mounted device page owns its captured Fleet and shared-account Karma clients. */
@Injectable()
export class DeviceConfigurationApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private fleet: ApolloBase | undefined;
  private karma: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;
  private language: Language = 'bg';

  initialize(branchId: string, language: Language): void {
    if (this.fleet || this.destroyed) {
      throw new Error('DeviceConfigurationApi belongs to one device workspace.');
    }
    const session = this.session.capture();
    this.language = language;
    this.fleet = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, { branchId, language }, session),
      ),
    );
    this.karma = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, session)),
    );
  }

  watchPage(deviceId: string) {
    if (!this.fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    return this.fleet.watchQuery({
      query: AdminDeviceConfigurationPageDocument,
      variables: { deviceId },
      fetchPolicy: 'network-only',
    });
  }

  watchTargets() {
    if (!this.karma || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    return this.karma.watchQuery({
      query: AdminDeviceConfigurationTargetsDocument,
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  async requestRead(input: AdminRequestDeviceConfigurationReadMutationVariables['input']) {
    const fleet = this.fleet;
    if (!fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        fleet.mutate({
          mutation: AdminRequestDeviceConfigurationReadDocument,
          variables: { input },
        }),
      );
      const operation = result.data?.requestFleetDeviceConfigurationRead;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceConfigurationRead result.');
      }
      fleet.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'fleetDeviceOperations',
        broadcast: false,
      });
      return operation;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async requestAddition(input: AdminRequestDeviceParameterAdditionMutationVariables['input']) {
    const fleet = this.fleet;
    if (!fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        fleet.mutate({
          mutation: AdminRequestDeviceParameterAdditionDocument,
          variables: { input },
        }),
      );
      const operation = result.data?.requestFleetDeviceParameterAddition;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceParameterAddition result.');
      }
      fleet.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'fleetDeviceOperations',
        broadcast: false,
      });
      return operation;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async requestIntervalUpdate(
    input: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'],
  ) {
    const fleet = this.fleet;
    if (!fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        fleet.mutate({
          mutation: AdminRequestDeviceParameterIntervalUpdateDocument,
          variables: { input },
        }),
      );
      const operation = result.data?.requestFleetDeviceParameterIntervalUpdate;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceParameterIntervalUpdate result.');
      }
      fleet.client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'fleetDeviceOperations',
        broadcast: false,
      });
      return operation;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.karma?.client.stop();
    this.karma = undefined;
    this.stopWhenIdle();
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.fleet?.client.stop();
      this.fleet = undefined;
    }
  }
}
