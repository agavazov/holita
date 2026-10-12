import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import {
  AdminKarmaUsersDocument,
  AdminKarmaRolesDocument,
  AdminKarmaCarDocument,
  AdminKarmaCarsDocument,
  AdminKarmaLocationDocument,
  AdminKarmaProjectsDocument,
  AdminKarmaTimeZonesDocument,
  AdminKarmaVersionDocument,
  AdminKarmaReferencesDocument,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';

@Injectable()
export class KarmaApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private language: Language = 'bg';

  initialize(language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('KarmaApi belongs to one session workspace.');
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, this.session.capture()),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
    this.language = language;
  }

  watch() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaCarsDocument,
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchCar(id: string) {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaCarDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchLocation(carId: string) {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaLocationDocument,
      variables: { carId },
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchUsers() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaUsersDocument,
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }
  watchRoles() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaRolesDocument,
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }
  watchProjects() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaProjectsDocument,

      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchTimeZones() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaTimeZonesDocument,

      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchVersion() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaVersionDocument,

      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchReferences() {
    if (!this.apollo || this.destroyed) throw new Error('An active Karma workspace is required.');
    return this.apollo.watchQuery({
      query: AdminKarmaReferencesDocument,

      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
}
