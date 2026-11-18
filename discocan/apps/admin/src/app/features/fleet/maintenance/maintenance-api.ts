import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminCancelServiceTasksDocument,
  AdminCompleteServiceTaskDocument,
  AdminCreateServiceTaskDocument,
  AdminDeleteServiceTasksDocument,
  AdminServiceSummaryDocument,
  AdminServiceTaskDocument,
  AdminServiceTasksDocument,
  AdminServiceVehiclesDocument,
  AdminUpdateServiceTaskDocument,
  type AdminCancelServiceTasksMutation,
  type AdminCompleteServiceTaskMutationVariables,
  type AdminCreateServiceTaskMutationVariables,
  type AdminServiceTasksQueryVariables,
  type AdminServiceVehiclesQueryVariables,
  type AdminUpdateServiceTaskMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
@Injectable()
export class MaintenanceApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;
  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('MaintenanceApi belongs to one Branch workspace.');
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
  watch(variables: AdminServiceTasksQueryVariables) {
    return this.activeClient().watchQuery({ query: AdminServiceTasksDocument, variables });
  }
  watchTask(id: string) {
    return this.activeClient().watchQuery({
      query: AdminServiceTaskDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }
  watchSummary() {
    return this.activeClient().watchQuery({
      query: AdminServiceSummaryDocument,
      fetchPolicy: 'network-only',
    });
  }
  watchVehicles(variables: AdminServiceVehiclesQueryVariables) {
    return this.activeClient().watchQuery({
      query: AdminServiceVehiclesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  async create(variables: AdminCreateServiceTaskMutationVariables) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCreateServiceTaskDocument, variables }),
      );
      if (!result.data?.createFleetServiceTask) {
        throw new Error('Missing createFleetServiceTask result.');
      }
      this.invalidate(apollo);
      return result.data.createFleetServiceTask;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async update(variables: AdminUpdateServiceTaskMutationVariables) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateServiceTaskDocument, variables }),
      );
      if (!result.data?.updateFleetServiceTask) {
        throw new Error('Missing updateFleetServiceTask result.');
      }
      this.invalidate(apollo);
      return result.data.updateFleetServiceTask;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async complete(variables: AdminCompleteServiceTaskMutationVariables) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminCompleteServiceTaskDocument, variables }),
      );
      if (!result.data?.completeFleetServiceTask) {
        throw new Error('Missing completeFleetServiceTask result.');
      }
      this.invalidate(apollo);
      return result.data.completeFleetServiceTask;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  async act(action: 'cancel' | 'delete', ids: readonly string[]) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      let result: AdminCancelServiceTasksMutation['cancelFleetServiceTasks'] | undefined;
      if (action === 'cancel') {
        const response = await firstValueFrom(
          apollo.mutate({
            mutation: AdminCancelServiceTasksDocument,
            variables: { ids: [...ids] },
          }),
        );
        result = response.data?.cancelFleetServiceTasks;
      } else {
        const response = await firstValueFrom(
          apollo.mutate({
            mutation: AdminDeleteServiceTasksDocument,
            variables: { ids: [...ids] },
          }),
        );
        result = response.data?.deleteFleetServiceTasks;
      }
      if (!result) {
        throw new Error('Missing service task action result.');
      }
      if (result.succeededIds.length) {
        if (action === 'delete') {
          for (const id of result.succeededIds) {
            const entity = apollo.client.cache.identify({ __typename: 'FleetServiceTask', id });
            if (entity) {
              apollo.client.cache.evict({ id: entity, broadcast: false });
            }
          }
        }
        this.invalidate(apollo);
      }
      return result;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }
  private activeClient(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Maintenance workspace is required.');
    }
    return this.apollo;
  }
  private invalidate(apollo: ApolloBase): void {
    apollo.client.cache.evict({
      id: 'ROOT_QUERY',
      fieldName: 'fleetServiceTasks',
      broadcast: false,
    });
    apollo.client.cache.evict({
      id: 'ROOT_QUERY',
      fieldName: 'fleetServiceSummary',
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
