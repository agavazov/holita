import { inject, Injectable, NgZone } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { Apollo, ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminBranchesDocument,
  AdminTenantsDocument,
  AdminDemoLoginDocument,
} from '../../../generated/graphql/operations';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';

@Injectable({ providedIn: 'root' })
export class BranchesApi {
  private readonly publicClient = inject(Apollo);
  private readonly httpLink = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private readonly session = inject(DemoSession);
  tenants(language: Language) {
    return this.publicClient.watchQuery({
      query: AdminTenantsDocument,
      context: { language },
      fetchPolicy: 'network-only',
    });
  }
  async login(tenantId: string, language: Language) {
    const result = await firstValueFrom(
      this.publicClient.mutate({
        mutation: AdminDemoLoginDocument,
        variables: { tenantId },
        context: { language },
      }),
    );
    if (!result.data?.demoLogin) {
      throw new Error('Missing demo login result.');
    }
    return result.data.demoLogin;
  }
  watch(language: Language, scope = this.session.capture()) {
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, scope),
    );
    const apollo = new ApolloBase(this.zone, undefined, client);
    const query = apollo.watchQuery({ query: AdminBranchesDocument, context: { language } });
    return {
      query,
      close: () => {
        client.stop();
      },
    };
  }
}
