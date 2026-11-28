import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesCreateLeadNoteDocument,
  SalesDeleteLeadNoteDocument,
  SalesLeadNoteDocument,
  SalesLeadNotesDocument,
  SalesUpdateLeadNoteDocument,
  type LeadNoteInput,
} from '../generated/leads-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class LeadNotesApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  async list(scope: SalesWorkspaceScope, leadId: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesLeadNotesDocument,
          variables: { leadId },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.leadNotes;
  }

  async find(scope: SalesWorkspaceScope, leadId: string, id: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesLeadNoteDocument,
          variables: { leadId, id },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.leadNote;
  }

  async save(scope: SalesWorkspaceScope, leadId: string, id: string | null, input: LeadNoteInput) {
    if (id) {
      await this.request(scope, (client, context) =>
        client.mutate({
          mutation: SalesUpdateLeadNoteDocument,
          variables: { leadId, id, input },
          context,
        }),
      );
      return;
    }
    await this.request(scope, (client, context) =>
      client.mutate({
        mutation: SalesCreateLeadNoteDocument,
        variables: { leadId, input },
        context,
      }),
    );
  }

  async remove(scope: SalesWorkspaceScope, leadId: string, id: string): Promise<void> {
    const data = await this.request(scope, (client, context) =>
      client.mutate({ mutation: SalesDeleteLeadNoteDocument, variables: { leadId, id }, context }),
    );
    if (!data.deleteLeadNote) {
      throw new Error('Missing lead note removal');
    }
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
        throw new Error('Missing lead note result');
      }
      return data;
    } finally {
      signal?.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
