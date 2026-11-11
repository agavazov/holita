import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { map, type Observable } from 'rxjs';
import {
  AdminCreateGeoZoneDocument,
  AdminDeleteGeoZoneDocument,
  AdminGeoZoneEventsDocument,
  AdminGeoZonesDocument,
  AdminUpdateGeoZoneDocument,
  type AdminGeoZoneEventsQueryVariables,
  type FleetGeoZoneInput,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One client per mounted geo-zones page: the zones with the Branch trucks, and the event log. */
@Injectable()
export class GeoZonesApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly session = inject(DemoSession);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('GeoZonesApi belongs to one workspace.');
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

  zones() {
    return this.client()
      .query({ query: AdminGeoZonesDocument, fetchPolicy: 'network-only' })
      .pipe(map((result) => required(result.data, 'The geo zones are unavailable.')));
  }

  events(variables: AdminGeoZoneEventsQueryVariables) {
    return this.client()
      .query({ query: AdminGeoZoneEventsDocument, variables, fetchPolicy: 'network-only' })
      .pipe(
        map(
          (result) => required(result.data, 'The geo-zone log is unavailable.').fleetGeoZoneEvents,
        ),
      );
  }

  save(id: string | null, input: FleetGeoZoneInput): Observable<void> {
    const saved = id
      ? this.client()
          .mutate({ mutation: AdminUpdateGeoZoneDocument, variables: { id, input } })
          .pipe(map(() => undefined))
      : this.client()
          .mutate({ mutation: AdminCreateGeoZoneDocument, variables: { input } })
          .pipe(map(() => undefined));
    return saved;
  }

  delete(id: string) {
    return this.client().mutate({ mutation: AdminDeleteGeoZoneDocument, variables: { id } });
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active geo-zones workspace is required.');
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
