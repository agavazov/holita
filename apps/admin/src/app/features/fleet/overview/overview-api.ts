import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { EMPTY, expand, map, scan } from 'rxjs';
import {
  AdminFleetOverviewDocument,
  AdminOverviewMapDocument,
  AdminOverviewConnectedDevicesDocument,
  type AdminFleetOverviewQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

@Injectable()
export class OverviewApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly session = inject(DemoSession);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('OverviewApi belongs to one workspace.');
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

  watch(variables: AdminFleetOverviewQueryVariables) {
    return this.client().watchQuery({
      query: AdminFleetOverviewDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  map() {
    return this.mapPage(0).pipe(
      expand((page) => (page.hasMore ? this.mapPage(page.offset + page.limit) : EMPTY)),
      scan((previous, page) => ({
        ...page,
        asOf: previous.asOf < page.asOf ? previous.asOf : page.asOf,
        liveAsOf: previous.liveAsOf < page.liveAsOf ? previous.liveAsOf : page.liveAsOf,
        items: [...previous.items, ...page.items],
      })),
    );
  }

  connectedDevices() {
    return this.devicePage(0).pipe(
      expand((page) =>
        page.offset + page.limit < page.total ? this.devicePage(page.offset + page.limit) : EMPTY,
      ),
      scan((previous, page) => ({ ...page, items: [...previous.items, ...page.items] })),
    );
  }

  private mapPage(offset: number) {
    return this.client()
      .query({
        query: AdminOverviewMapDocument,
        variables: { offset, limit: 100 },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Fleet map is unavailable.');
          }
          return result.data.fleetMap;
        }),
      );
  }

  private devicePage(offset: number) {
    return this.client()
      .query({
        query: AdminOverviewConnectedDevicesDocument,
        variables: { offset, limit: 100 },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Device connections are unavailable.');
          }
          return result.data.fleetDevices;
        }),
      );
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Overview workspace is required.');
    }
    return this.apollo;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
}
