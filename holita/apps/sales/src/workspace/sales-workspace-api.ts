import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { UI_LANGUAGE, type Language } from '@osnova/ui';
import { DemoSession, OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import { OperatorSalesWorkspaceDocument } from '../generated/operations';

export interface SalesWorkspaceScope {
  readonly tenantId: string;
  readonly token: string;
  readonly language: Language;
}

@Injectable({ providedIn: 'root' })
export class SalesWorkspaceApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(UI_LANGUAGE);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  private readonly token = computed(() => this.session.current()?.token);
  readonly scope = computed<SalesWorkspaceScope | undefined>(() => {
    const tenantId = this.tenantId();
    const token = this.token();
    return tenantId && token ? { tenantId, token, language: this.language() } : undefined;
  });

  async read(scope: SalesWorkspaceScope, abortSignal: AbortSignal) {
    const client = new ApolloClient(
      graphqlOptions(this.link, this.config.graphqlUrl, undefined, scope),
    );
    const stop = () => {
      client.stop();
    };
    abortSignal.addEventListener('abort', stop, { once: true });
    try {
      const { data } = await client.query({
        query: OperatorSalesWorkspaceDocument,
        fetchPolicy: 'no-cache',
        context: { language: scope.language },
      });
      if (!data?.salesWorkspaceAccess) {
        throw new Error('Missing Sales workspace identity.');
      }
      return data.salesWorkspaceAccess;
    } finally {
      abortSignal.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
