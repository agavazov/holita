import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { AdminFleetOverviewDocument } from '../../../../generated/graphql/operations';
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
  private client: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.client || this.destroyed) {
      throw new Error('OverviewApi belongs to one workspace.');
    }
    this.client = new ApolloBase(
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

  watch() {
    if (!this.client || this.destroyed) {
      throw new Error('An active Overview workspace is required.');
    }
    return this.client.watchQuery({
      query: AdminFleetOverviewDocument,
      fetchPolicy: 'network-only',
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.client?.client.stop();
    this.client = undefined;
  }
}
