import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { UI_LANGUAGE } from '@osnova/ui';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import {
  OperatorCreateBranchDocument,
  OperatorCreateMerchantDocument,
  OperatorMerchantDocument,
  OperatorMerchantsDocument,
  OperatorSetBranchStatusDocument,
  OperatorSetMerchantStatusDocument,
  type AccountStatus,
  type OperatorCreateMerchantMutationVariables,
  type OperatorMerchantsQueryVariables,
} from './generated/operations';

type OperatorScope = ReturnType<DemoSession['capture']> & { language: Language };

@Injectable({ providedIn: 'root' })
export class OperatorApi {
  private readonly session = inject(DemoSession);
  private readonly http = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly language = inject(UI_LANGUAGE);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  private readonly token = computed(() => this.session.current()?.token);
  readonly scope = computed<OperatorScope | null>(() => {
    const tenantId = this.tenantId();
    const token = this.token();
    return tenantId && token ? { tenantId, token, language: this.language() } : null;
  });

  private client(session = this.session.capture()): ApolloClient {
    return new ApolloClient(graphqlOptions(this.http, this.config.graphqlUrl, undefined, session));
  }

  async merchants(
    scope: OperatorScope,
    variables: OperatorMerchantsQueryVariables,
    signal: AbortSignal,
  ) {
    const data = await this.read(scope, signal, (client, context) =>
      client.query({
        query: OperatorMerchantsDocument,
        variables,
        fetchPolicy: 'no-cache',
        context,
      }),
    );
    return data.merchants;
  }

  async merchant(scope: OperatorScope, tenantId: string, signal: AbortSignal) {
    const data = await this.read(scope, signal, (client, context) =>
      client.query({
        query: OperatorMerchantDocument,
        variables: { tenantId },
        fetchPolicy: 'no-cache',
        context,
      }),
    );
    return data.merchant;
  }

  private async read<T>(
    scope: OperatorScope,
    signal: AbortSignal,
    query: (
      client: ApolloClient,
      context: { language: Language },
    ) => Promise<{ data: T | undefined }>,
  ): Promise<T> {
    const client = this.client(scope);
    const stop = () => {
      client.stop();
    };
    signal.addEventListener('abort', stop, { once: true });
    try {
      const { data } = await query(client, { language: scope.language });
      if (!data) {
        throw new Error('Missing merchant result');
      }
      return data;
    } finally {
      signal.removeEventListener('abort', stop);
      client.stop();
    }
  }

  async createMerchant(
    language: Language,
    variables: OperatorCreateMerchantMutationVariables,
  ): Promise<void> {
    const client = this.client();
    try {
      await client.mutate({
        mutation: OperatorCreateMerchantDocument,
        variables,
        context: { language },
      });
    } finally {
      client.stop();
    }
  }

  async setMerchantStatus(
    language: Language,
    tenantId: string,
    status: AccountStatus,
  ): Promise<void> {
    const client = this.client();
    try {
      await client.mutate({
        mutation: OperatorSetMerchantStatusDocument,
        variables: { tenantId, status },
        context: { language },
      });
    } finally {
      client.stop();
    }
  }

  async createBranch(language: Language, tenantId: string, name: string): Promise<void> {
    const client = this.client();
    try {
      await client.mutate({
        mutation: OperatorCreateBranchDocument,
        variables: { tenantId, name },
        context: { language },
      });
    } finally {
      client.stop();
    }
  }

  async setBranchStatus(
    language: Language,
    tenantId: string,
    branchId: string,
    status: AccountStatus,
  ): Promise<void> {
    const client = this.client();
    try {
      await client.mutate({
        mutation: OperatorSetBranchStatusDocument,
        variables: { tenantId, branchId, status },
        context: { language },
      });
    } finally {
      client.stop();
    }
  }
}
