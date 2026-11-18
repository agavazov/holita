import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminAcknowledgeAlertDocument,
  AdminAcknowledgeAlertsDocument,
  AdminAlertCountsDocument,
  AdminAlertDocument,
  AdminAlertsDataClockDocument,
  AdminAlertsDocument,
  AdminAlertVehiclesDocument,
  AdminReopenAlertDocument,
  AdminResolveAlertDocument,
  type AdminAcknowledgeAlertMutationVariables,
  type AdminAlertCountsQueryVariables,
  type AdminAlertDetailsFragment,
  type AdminAlertsQueryVariables,
  type AdminAlertVehiclesQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import type { AlertAction } from './alert-drawer';

@Injectable()
export class AlertsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('AlertsApi belongs to one Branch workspace.');
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

  watch(variables: AdminAlertsQueryVariables) {
    return this.activeClient().watchQuery({ query: AdminAlertsDocument, variables });
  }
  watchAlert(id: string) {
    return this.activeClient().watchQuery({
      query: AdminAlertDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }
  watchCounts(variables: AdminAlertCountsQueryVariables) {
    return this.activeClient().watchQuery({
      query: AdminAlertCountsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  watchClock() {
    return this.activeClient().watchQuery({
      query: AdminAlertsDataClockDocument,
      fetchPolicy: 'network-only',
    });
  }
  watchVehicles(variables: AdminAlertVehiclesQueryVariables) {
    return this.activeClient().watchQuery({
      query: AdminAlertVehiclesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async acknowledgeMany(ids: readonly string[]) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminAcknowledgeAlertsDocument,
          variables: { ids: [...ids], input: { expectedStatus: 'OPEN' } },
        }),
      );
      if (!result.data?.acknowledgeFleetAlerts) {
        throw new Error('Missing acknowledgeFleetAlerts result.');
      }
      if (result.data.acknowledgeFleetAlerts.succeededIds.length) {
        this.invalidate(apollo);
      }
      return result.data.acknowledgeFleetAlerts;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async transition(action: AlertAction, variables: AdminAcknowledgeAlertMutationVariables) {
    const apollo = this.activeClient();
    this.pendingWrites++;
    try {
      let event: AdminAlertDetailsFragment | undefined;
      if (action === 'acknowledge') {
        const result = await firstValueFrom(
          apollo.mutate({ mutation: AdminAcknowledgeAlertDocument, variables }),
        );
        event = result.data?.acknowledgeFleetAlert;
      } else if (action === 'resolve') {
        const result = await firstValueFrom(
          apollo.mutate({ mutation: AdminResolveAlertDocument, variables }),
        );
        event = result.data?.resolveFleetAlert;
      } else {
        const result = await firstValueFrom(
          apollo.mutate({ mutation: AdminReopenAlertDocument, variables }),
        );
        event = result.data?.reopenFleetAlert;
      }
      if (!event) {
        throw new Error('Missing alert transition result.');
      }
      this.invalidate(apollo);
      return event;
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
      throw new Error('An active Alerts workspace is required.');
    }
    return this.apollo;
  }
  private invalidate(apollo: ApolloBase): void {
    apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetEvents', broadcast: false });
    apollo.client.cache.evict({
      id: 'ROOT_QUERY',
      fieldName: 'fleetAlertCounts',
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
