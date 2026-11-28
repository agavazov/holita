import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesCreateLeadTaskDocument,
  SalesLeadTaskDocument,
  SalesLeadTasksDocument,
  SalesTaskQueueDocument,
  SalesUpdateLeadTaskDocument,
  SalesUpdateLeadTaskStatusDocument,
  type LeadTaskInput,
  type LeadTaskStatus,
  type SalesTaskQueueQueryVariables,
} from '../generated/leads-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class LeadTasksApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  async queue(
    scope: SalesWorkspaceScope,
    variables: SalesTaskQueueQueryVariables,
    signal: AbortSignal,
  ) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesTaskQueueDocument,
          variables,
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.salesTaskQueue;
  }

  async list(scope: SalesWorkspaceScope, leadId: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesLeadTasksDocument,
          variables: { leadId },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.leadTasks;
  }

  async find(scope: SalesWorkspaceScope, leadId: string, id: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesLeadTaskDocument,
          variables: { leadId, id },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.leadTask;
  }

  async save(scope: SalesWorkspaceScope, leadId: string, id: string | null, input: LeadTaskInput) {
    if (id) {
      await this.request(scope, (client, context) =>
        client.mutate({
          mutation: SalesUpdateLeadTaskDocument,
          variables: { leadId, id, input },
          context,
        }),
      );
      return;
    }
    await this.request(scope, (client, context) =>
      client.mutate({
        mutation: SalesCreateLeadTaskDocument,
        variables: { leadId, input },
        context,
      }),
    );
  }

  async updateStatus(
    scope: SalesWorkspaceScope,
    leadId: string,
    id: string,
    status: LeadTaskStatus,
  ) {
    await this.request(scope, (client, context) =>
      client.mutate({
        mutation: SalesUpdateLeadTaskStatusDocument,
        variables: { leadId, id, status },
        context,
      }),
    );
  }

  private async request<TData>(
    scope: SalesWorkspaceScope,
    run: (
      client: ApolloClient,
      context: { language: SalesWorkspaceScope['language'] },
    ) => Promise<{ data?: TData | null | undefined }>,
    signal?: AbortSignal,
  ): Promise<TData> {
    const client = new ApolloClient(
      graphqlOptions(this.link, this.config.graphqlUrl, undefined, scope),
    );
    const stop = () => {
      client.stop();
    };
    signal?.addEventListener('abort', stop, { once: true });
    try {
      const { data } = await run(client, { language: scope.language });
      if (!data) {
        throw new Error('Missing lead task result');
      }
      return data;
    } finally {
      signal?.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
