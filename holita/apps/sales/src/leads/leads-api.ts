import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesCreateLeadDocument,
  SalesLeadDocument,
  SalesLeadsDocument,
  SalesUpdateLeadDocument,
  SalesUpdateLeadStageDocument,
  type LeadInput,
  type LeadStage,
  type SalesLeadsQueryVariables,
} from '../generated/leads-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class LeadsApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  private client(scope: SalesWorkspaceScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, undefined, scope));
  }

  async list(scope: SalesWorkspaceScope, variables: SalesLeadsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: SalesLeadsDocument,
        variables,
        fetchPolicy: 'no-cache',
        context: { language: scope.language },
      });
      if (!data) {
        throw new Error('Missing leads result');
      }
      return data.leads;
    } finally {
      client.stop();
    }
  }

  async find(scope: SalesWorkspaceScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: SalesLeadDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
        context: { language: scope.language },
      });
      if (!data) {
        throw new Error('Missing lead result');
      }
      return data.lead;
    } finally {
      client.stop();
    }
  }

  async save(scope: SalesWorkspaceScope, input: LeadInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    const context = { language: scope.language };
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: SalesUpdateLeadDocument,
          variables: { id, input },
          context,
        });
        if (data) {
          return data.updateLead.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: SalesCreateLeadDocument,
          variables: { input },
          context,
        });
        if (data) {
          return data.createLead.id;
        }
      }
      throw new Error('Missing saved lead');
    } finally {
      client.stop();
    }
  }

  async updateStage(scope: SalesWorkspaceScope, id: string, stage: LeadStage) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: SalesUpdateLeadStageDocument,
        variables: { id, stage },
        context: { language: scope.language },
      });
      if (!data) {
        throw new Error('Missing saved lead stage');
      }
      return data.updateLeadStage;
    } finally {
      client.stop();
    }
  }
}
