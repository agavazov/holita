import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import {
  AdminKarmaCarDocument,
  AdminKarmaTripsDocument,
  AdminKarmaEventsDocument,
  AdminKarmaDrivingProfileDocument,
  AdminKarmaDailyReportDocument,
  AdminKarmaPositionSamplesDocument,
  type KarmaTripsInput,
  type KarmaEventsInput,
  type KarmaDrivingProfileInput,
  type KarmaDailyReportInput,
  type KarmaPositionSamplesInput,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';

@Injectable()
export class KarmaHistoryApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private language: Language = 'bg';

  initialize(language: Language): void {
    if (this.apollo) {
      throw new Error('KarmaHistoryApi belongs to one session workspace.');
    }
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, this.session.capture()),
      ),
    );
    this.language = language;
  }

  watchCar(id: string) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaCarDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchTrips(input: KarmaTripsInput) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaTripsDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchDailyReport(input: KarmaDailyReportInput) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaDailyReportDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchEvents(input: KarmaEventsInput) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaEventsDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchPositionSamples(input: KarmaPositionSamplesInput) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaPositionSamplesDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchDrivingProfile(input: KarmaDrivingProfileInput) {
    if (!this.apollo) {
      throw new Error('An active Karma workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminKarmaDrivingProfileDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  ngOnDestroy(): void {
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
}
