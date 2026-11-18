import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom, map } from 'rxjs';
import {
  AdminLiveFleetDocument,
  AdminLiveTrackDocument,
  AdminLiveVehicleDocument,
  AdminReadFaultsNowDocument,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One client per mounted dashboard: the fleet, the selected truck and its recorded trail. */
@Injectable()
export class LiveDashboardApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly session = inject(DemoSession);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('LiveDashboardApi belongs to one workspace.');
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

  fleet() {
    return this.client()
      .query({ query: AdminLiveFleetDocument, fetchPolicy: 'network-only' })
      .pipe(map((result) => required(result.data, 'The fleet is unavailable.')));
  }

  vehicle(id: string) {
    return this.client()
      .query({ query: AdminLiveVehicleDocument, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((result) => required(result.data, 'The truck is unavailable.')));
  }

  track(vehicleId: string, from: string, to: string) {
    return this.client()
      .query({
        query: AdminLiveTrackDocument,
        variables: { vehicleId, from, to },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => required(result.data, 'The trail is unavailable.').fleetVehicleSamples),
      );
  }

  /** Queues the allowlisted fault-logger read (GET DTC) for the Device. */
  async readFaults(deviceId: string) {
    const result = await firstValueFrom(
      this.client().mutate({ mutation: AdminReadFaultsNowDocument, variables: { deviceId } }),
    );
    return required(result.data?.sendErmDeviceCommand, 'The fault read was not queued.');
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active dashboard workspace is required.');
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
