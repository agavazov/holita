import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminVehicleProfileDocument,
  AdminVehicleProfileTripsDocument,
  AdminVehicleProfileProblemsDocument,
  AdminVehicleTrackDocument,
  AdminVehicleMapDocument,
  AdminVehicleEdataMeasurementsDocument,
  AdminVehicleEdataLatestDocument,
  AdminVehicleEdataHistoryDocument,
  AdminVehicleProfileServiceDocument,
  AdminVehicleOdometerDocument,
  AdminRecordOdometerDocument,
  AdminReadFaultsNowDocument,
  type AdminRecordOdometerMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';
import {
  profileProblemSort,
  profileServiceSort,
  profileTripSort,
  type ProfileSort,
} from './vehicle-profile-query';

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
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  watchOdometer(id: string) {
    return this.client().watchQuery({
      query: AdminVehicleOdometerDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  watchTrips(vehicleId: string, page: number, pageSize: number, sort: ProfileSort) {
    return this.client().watchQuery({
      query: AdminVehicleProfileTripsDocument,
      variables: {
        vehicleId,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort: profileTripSort(sort),
      },
      fetchPolicy: 'network-only',
    });
  }

  watchProblems(vehicleId: string, page: number, pageSize: number, sort: ProfileSort) {
    return this.client().watchQuery({
      query: AdminVehicleProfileProblemsDocument,
      variables: {
        vehicleId,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort: profileProblemSort(sort),
      },
      fetchPolicy: 'network-only',
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  mapPage(offset: number) {
    return this.client().query({
      query: AdminVehicleMapDocument,
      variables: { offset, limit: 100 },
      fetchPolicy: 'network-only',
    });
  }

  watchTrack(vehicleId: string, from: string, to: string) {
    return this.client().watchQuery({
      query: AdminVehicleTrackDocument,
      variables: { vehicleId, from, to },
      fetchPolicy: 'network-only',
    });
  }

  watchEdataMeasurements(vehicleId: string, from: string, to: string) {
    return this.client().watchQuery({
      query: AdminVehicleEdataMeasurementsDocument,
      variables: { vehicleId, from, to },
      fetchPolicy: 'network-only',
    });
  }

  watchEdataLatest(vehicleId: string) {
    return this.client().watchQuery({
      query: AdminVehicleEdataLatestDocument,
      variables: { vehicleId },
      fetchPolicy: 'network-only',
      pollInterval: 60_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  edataHistory(vehicleId: string, parameterId: number, from: string, to: string) {
    return this.client().query({
      query: AdminVehicleEdataHistoryDocument,
      variables: { vehicleId, from, to, parameterIds: [parameterId] },
      fetchPolicy: 'network-only',
    });
  }

  watchService(vehicleId: string, page: number, pageSize: number, sort: ProfileSort) {
    return this.client().watchQuery({
      query: AdminVehicleProfileServiceDocument,
      variables: {
        vehicleId,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort: profileServiceSort(sort),
      },
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

  /** Queues the allowlisted fault-logger read (GET DTC) for the Device. */
  async readFaults(deviceId: string) {
    const apollo = this.client();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminReadFaultsNowDocument, variables: { deviceId } }),
      );
      if (!result.data?.sendErmDeviceCommand) {
        throw new Error('Missing sendErmDeviceCommand result.');
      }
      return result.data.sendErmDeviceCommand;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  /** Reloads the open profile, for example while a fault read runs. */
  async refreshVehicle(): Promise<void> {
    await this.client().client.refetchQueries({ include: [AdminVehicleProfileDocument] });
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
