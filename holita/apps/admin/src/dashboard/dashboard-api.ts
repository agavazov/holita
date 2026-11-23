import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorShopDashboardDocument,
  type DashboardPeriod,
} from '../generated/dashboard-operations';

interface DashboardScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<DashboardScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  async read(scope: DashboardScope, period: DashboardPeriod) {
    const client = new ApolloClient(
      graphqlOptions(this.link, this.config.graphqlUrl, scope, scope),
    );
    try {
      const { data } = await client.query({
        query: OperatorShopDashboardDocument,
        variables: { period },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing shop dashboard');
      }
      return data.shopDashboard;
    } finally {
      client.stop();
    }
  }
}
