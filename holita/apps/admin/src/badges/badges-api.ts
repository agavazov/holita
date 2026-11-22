import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateBadgeDocument,
  OperatorBadgeDocument,
  OperatorBadgesDocument,
  OperatorUpdateBadgeDocument,
  type OperatorBadgesQueryVariables,
  type ProductBadgeInput,
} from '../generated/badges-operations';

interface BadgeScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class BadgesApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<BadgeScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: BadgeScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: BadgeScope, variables: OperatorBadgesQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBadgesDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing badges');
      }
      return data.productBadges;
    } finally {
      client.stop();
    }
  }

  async find(scope: BadgeScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBadgeDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing badge result');
      }
      return data.productBadge;
    } finally {
      client.stop();
    }
  }

  async save(scope: BadgeScope, input: ProductBadgeInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateBadgeDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateProductBadge.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateBadgeDocument,
          variables: { input },
        });
        if (data) {
          return data.createProductBadge.id;
        }
      }
      throw new Error('Missing saved badge');
    } finally {
      client.stop();
    }
  }
}
