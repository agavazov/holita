import { Injectable, computed, inject } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateNavigationMenuDocument,
  OperatorNavigationDestinationChoicesDocument,
  OperatorNavigationMenuDocument,
  OperatorNavigationMenusDocument,
  OperatorUpdateNavigationMenuDocument,
  type CreateNavigationMenuInput,
  type OperatorNavigationDestinationChoicesQueryVariables,
} from '../generated/navigation-operations';

interface NavigationScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class NavigationApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<NavigationScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: NavigationScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: NavigationScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorNavigationMenusDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing navigation menus');
      }
      return data.navigationMenus;
    } finally {
      client.stop();
    }
  }

  async find(scope: NavigationScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorNavigationMenuDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing navigation menu result');
      }
      return data.navigationMenu;
    } finally {
      client.stop();
    }
  }

  async choices(
    scope: NavigationScope,
    variables: OperatorNavigationDestinationChoicesQueryVariables,
  ) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorNavigationDestinationChoicesDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing navigation destinations');
      }
      return data.navigationDestinationChoices;
    } finally {
      client.stop();
    }
  }

  async save(
    scope: NavigationScope,
    input: CreateNavigationMenuInput,
    id: string | null,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateNavigationMenuDocument,
          variables: { id, items: input.items },
        });
        if (data) {
          return data.updateNavigationMenu.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateNavigationMenuDocument,
          variables: { input },
        });
        if (data) {
          return data.createNavigationMenu.id;
        }
      }
      throw new Error('Missing saved navigation menu');
    } finally {
      client.stop();
    }
  }
}
