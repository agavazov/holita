import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { map } from 'rxjs';
import {
  AdminFaultLogDocument,
  AdminFaultMonitorDocument,
  type AdminFaultLogQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '@osnova/ui/app';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '@osnova/ui/app';
import type { Language } from '../../../i18n/messages';

/** One client per mounted faults page: the trucks' fault states and the fault log. */
@Injectable()
export class FaultsApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly session = inject(DemoSession);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('FaultsApi belongs to one workspace.');
    }
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

  monitor() {
    return this.client()
      .query({ query: AdminFaultMonitorDocument, fetchPolicy: 'network-only' })
      .pipe(
        map(
          (result) => required(result.data, 'The fault states are unavailable.').fleetFaultMonitor,
        ),
      );
  }

  log(variables: AdminFaultLogQueryVariables) {
    return this.client()
      .query({ query: AdminFaultLogDocument, variables, fetchPolicy: 'network-only' })
      .pipe(map((result) => required(result.data, 'The fault log is unavailable.').fleetFaultLog));
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active faults workspace is required.');
    }
    return this.apollo;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
}

function required<T>(data: T | undefined, message: string): T {
  if (!data) {
    throw new Error(message);
  }
  return data;
}
