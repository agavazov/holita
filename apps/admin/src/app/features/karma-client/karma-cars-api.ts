import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { AdminKarmaCarsDocument } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';

@Injectable()
export class KarmaCarsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private language: Language = 'bg';

  initialize(language: Language): void {
    if (this.apollo || this.destroyed)
      throw new Error('KarmaCarsApi belongs to one session workspace.');
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

  ngOnDestroy(): void {
    this.destroyed = true;
    this.apollo?.client.stop();
    this.apollo = undefined;
  }
}
