import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminRequestDeviceRulesReadDocument,
  AdminRequestDeviceRuleChangeDocument,
  type AdminRequestDeviceRulesReadMutationVariables,
  type AdminRequestDeviceRuleChangeMutationVariables,
  AdminDeviceConfigurationPageDocument,
  AdminRequestDeviceConfigurationReadDocument,
  AdminRequestDeviceParameterAdditionDocument,
  AdminRequestDeviceParameterIntervalUpdateDocument,
  type AdminRequestDeviceConfigurationReadMutationVariables,
  type AdminDeviceConfigurationPageQueryVariables,
  type AdminRequestDeviceParameterAdditionMutationVariables,
  type AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One mounted device page owns its captured Fleet client. */
@Injectable()
export class DeviceConfigurationApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private fleet: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.fleet || this.destroyed) {
      throw new Error('DeviceConfigurationApi belongs to one device workspace.');
    }
    const session = this.session.capture();
    this.fleet = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, { branchId, language }, session),
      ),
    );
  }

  watchPage(variables: AdminDeviceConfigurationPageQueryVariables) {
    if (!this.fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    return this.fleet.watchQuery({
      query: AdminDeviceConfigurationPageDocument,
      variables,
      fetchPolicy: 'network-only',
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

  async requestRulesRead(input: AdminRequestDeviceRulesReadMutationVariables['input']) {
    const fleet = this.fleet;
    if (!fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        fleet.mutate({ mutation: AdminRequestDeviceRulesReadDocument, variables: { input } }),
      );
      const operation = result.data?.requestFleetDeviceRulesRead;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceRulesRead result.');
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

  async requestRuleChange(input: AdminRequestDeviceRuleChangeMutationVariables['input']) {
    const fleet = this.fleet;
    if (!fleet || this.destroyed) {
      throw new Error('An active device configuration workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        fleet.mutate({ mutation: AdminRequestDeviceRuleChangeDocument, variables: { input } }),
      );
      const operation = result.data?.requestFleetDeviceRuleChange;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceRuleChange result.');
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
    this.stopWhenIdle();
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.fleet?.client.stop();
      this.fleet = undefined;
    }
  }
}
