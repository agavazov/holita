import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import {
  AdminTripDocument,
  AdminTripDriversDocument,
  AdminTripsDocument,
  AdminTripSummaryDocument,
  AdminTripVehiclesDocument,
  type AdminTripDriversQueryVariables,
  type AdminTripsQueryVariables,
  type AdminTripVehiclesQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

@Injectable()
export class TripsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('TripsApi belongs to one Branch workspace.');
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
  watch(variables: AdminTripsQueryVariables) {
    return this.activeClient().watchQuery({ query: AdminTripsDocument, variables });
  }
  watchTrip(id: string) {
    return this.activeClient().watchQuery({
      query: AdminTripDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }
  watchSummary() {
    return this.activeClient().watchQuery({
      query: AdminTripSummaryDocument,
      fetchPolicy: 'network-only',
    });
  }
  watchVehicles(variables: AdminTripVehiclesQueryVariables) {
    return this.activeClient().watchQuery({
      query: AdminTripVehiclesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  watchDrivers(variables: AdminTripDriversQueryVariables) {
    return this.activeClient().watchQuery({
      query: AdminTripDriversDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
  private activeClient(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Trips workspace is required.');
    }
    return this.apollo;
  }
}
