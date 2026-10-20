import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminVehicleProfileDocument,
  AdminVehicleProfileTripsDocument,
  AdminVehicleProfileAlertsDocument,
  AdminVehicleProfileServiceDocument,
  AdminVehicleOdometerDocument,
  AdminRecordOdometerDocument,
  type AdminRecordOdometerMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** One captured session, Branch and language per profile or odometer drawer. */
@Injectable()
export class VehicleProfileApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('VehicleProfileApi belongs to one Branch record workspace.');
    }
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(
          this.httpLink,
          this.config.graphqlUrl,
          { branchId, language },
          this.session.capture(),
        ),
      ),
    );
  }

  watchVehicle(id: string) {
    return this.client().watchQuery({
      query: AdminVehicleProfileDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  watchOdometer(id: string) {
    return this.client().watchQuery({
      query: AdminVehicleOdometerDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  watchTrips(vehicleId: string, page: number, pageSize: number) {
    return this.client().watchQuery({
      query: AdminVehicleProfileTripsDocument,
      variables: { vehicleId, offset: (page - 1) * pageSize, limit: pageSize },
      fetchPolicy: 'network-only',
    });
  }

  watchAlerts(vehicleId: string, page: number, pageSize: number) {
    return this.client().watchQuery({
      query: AdminVehicleProfileAlertsDocument,
      variables: { vehicleId, offset: (page - 1) * pageSize, limit: pageSize },
      fetchPolicy: 'network-only',
    });
  }

  watchService(vehicleId: string, page: number, pageSize: number) {
    return this.client().watchQuery({
      query: AdminVehicleProfileServiceDocument,
      variables: { vehicleId, offset: (page - 1) * pageSize, limit: pageSize },
      fetchPolicy: 'network-only',
    });
  }

  async recordOdometer(input: AdminRecordOdometerMutationVariables['input']) {
    const apollo = this.client();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminRecordOdometerDocument, variables: { input } }),
      );
      if (!result.data?.recordFleetOdometerReading) {
        throw new Error('Missing recordFleetOdometerReading result.');
      }
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetVehicle' });
      return result.data.recordFleetOdometerReading;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private client(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Vehicle profile workspace is required.');
    }
    return this.apollo;
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
