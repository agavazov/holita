import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesContactsDocument,
  SalesCreateLeadContactDocument,
  SalesDeleteLeadContactDocument,
  SalesLeadContactDocument,
  SalesLeadContactsDocument,
  SalesUpdateLeadContactDocument,
  type LeadContactInput,
  type SalesContactsQueryVariables,
} from '../generated/contacts-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class ContactsApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  async listForLead(scope: SalesWorkspaceScope, leadId: string, signal: AbortSignal) {
    const data = await this.read(scope, signal, (client, context) =>
      client.query({
        query: SalesLeadContactsDocument,
        variables: { leadId },
        fetchPolicy: 'no-cache',
        context,
      }),
    );
    return data.leadContacts;
  }

  async find(scope: SalesWorkspaceScope, leadId: string, id: string, signal: AbortSignal) {
    const data = await this.read(scope, signal, (client, context) =>
      client.query({
        query: SalesLeadContactDocument,
        variables: { leadId, id },
        fetchPolicy: 'no-cache',
        context,
      }),
    );
    return data.leadContact;
  }

  async browse(
    scope: SalesWorkspaceScope,
    variables: SalesContactsQueryVariables,
    signal: AbortSignal,
  ) {
    const data = await this.read(scope, signal, (client, context) =>
      client.query({ query: SalesContactsDocument, variables, fetchPolicy: 'no-cache', context }),
    );
    return data.salesContacts;
  }

  async save(
    scope: SalesWorkspaceScope,
    leadId: string,
    id: string | null,
    input: LeadContactInput,
  ): Promise<string> {
    const client = this.client(scope);
    const context = { language: scope.language };
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: SalesUpdateLeadContactDocument,
          variables: { leadId, id, input },
          context,
        });
        if (data) {
          return data.updateLeadContact.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: SalesCreateLeadContactDocument,
          variables: { leadId, input },
          context,
        });
        if (data) {
          return data.createLeadContact.id;
        }
      }
      throw new Error('Missing saved contact');
    } finally {
      client.stop();
    }
  }

  async remove(scope: SalesWorkspaceScope, leadId: string, id: string): Promise<void> {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: SalesDeleteLeadContactDocument,
        variables: { leadId, id },
        context: { language: scope.language },
      });
      if (!data?.deleteLeadContact) {
        throw new Error('Missing contact removal');
      }
    } finally {
      client.stop();
    }
  }

  private client(scope: SalesWorkspaceScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, undefined, scope));
  }

  private async read<TData>(
    scope: SalesWorkspaceScope,
    signal: AbortSignal,
    query: (
      client: ApolloClient,
      context: { language: SalesWorkspaceScope['language'] },
    ) => Promise<{ data: TData | undefined }>,
  ): Promise<TData> {
    const client = this.client(scope);
    const stop = () => {
      client.stop();
    };
    signal.addEventListener('abort', stop, { once: true });
    try {
      const { data } = await query(client, { language: scope.language });
      if (!data) {
        throw new Error('Missing contacts result');
      }
      return data;
    } finally {
      signal.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
