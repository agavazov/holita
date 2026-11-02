import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminKarmaMonitoringSettingsDocument,
  AdminKarmaMonitoringTrucksDocument,
  AdminKarmaMonitoringEventsDocument,
  AdminUpdateKarmaMonitoringSettingsDocument,
  type AdminKarmaMonitoringTrucksQueryVariables,
  type AdminKarmaMonitoringEventsQueryVariables,
  type UpdateFleetKarmaMonitoringSettingsInput,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One mounted Branch/language/session owns the client, including submitted saves. */
@Injectable()
export class MonitoringApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(
          this.http,
          this.config.graphqlUrl,
          { branchId, language },
          this.session.capture(),
        ),
      ),
    );
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Karma monitoring workspace is required.');
    }
    return this.apollo;
  }

  settings() {
    return this.client().watchQuery({
      query: AdminKarmaMonitoringSettingsDocument,
      fetchPolicy: 'network-only',
    });
  }
  trucks(variables: AdminKarmaMonitoringTrucksQueryVariables) {
    return this.client().watchQuery({
      query: AdminKarmaMonitoringTrucksDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  events(variables: AdminKarmaMonitoringEventsQueryVariables) {
    return this.client().watchQuery({
      query: AdminKarmaMonitoringEventsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  async save(input: UpdateFleetKarmaMonitoringSettingsInput) {
    const apollo = this.client();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminUpdateKarmaMonitoringSettingsDocument,
          variables: { input },
        }),
      );
      if (!result.data) {
        throw new Error('Missing monitoring settings result.');
      }
      return result.data.updateFleetKarmaMonitoringSettings;
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
    }
  }
}
