import { inject, Injectable, NgZone } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { Apollo, ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminMeDocument,
  AdminSignInDocument,
  AdminSignOutDocument,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { AdminConfig } from '../config/admin-config';
import { graphqlOptions } from '../graphql/graphql-options';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly publicClient = inject(Apollo);
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);

  async signIn(email: string, password: string, language: Language) {
    const result = await firstValueFrom(
      this.publicClient.mutate({
        mutation: AdminSignInDocument,
        variables: { email: email.trim(), password },
        context: { language },
      }),
    );
    if (!result.data?.signIn) {
      throw new Error('Missing sign-in result.');
    }
    return result.data.signIn;
  }

  watch(scope: Readonly<{ tenantId: string; token: string }>) {
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, scope),
    );
    const apollo = new ApolloBase(this.zone, undefined, client);
    return {
      query: apollo.watchQuery({
        query: AdminMeDocument,
        fetchPolicy: 'network-only',
        pollInterval: 60_000,
        skipPollAttempt: () => document.hidden,
      }),
      close: () => {
        client.stop();
      },
    };
  }

  async signOut(scope: Readonly<{ tenantId: string; token: string }>): Promise<void> {
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, scope),
    );
    try {
      await client.mutate({ mutation: AdminSignOutDocument });
    } finally {
      client.stop();
    }
  }
}
