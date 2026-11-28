import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesAgentsDocument,
  SalesCreateLeadDocument,
  SalesLeadAssignmentAgentsDocument,
  SalesLeadDocument,
  SalesLeadsDocument,
  SalesUpdateLeadDocument,
  SalesUpdateLeadAssignmentDocument,
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

  async agents(
    scope: SalesWorkspaceScope,
    selection: string[] | 'eligible' | 'assigned',
    signal: AbortSignal,
  ) {
    const client = this.client(scope);
    const stop = () => {
      client.stop();
    };
    signal.addEventListener('abort', stop, { once: true });
    try {
      const options = {
        fetchPolicy: 'no-cache',
        context: { language: scope.language },
      } as const;
      const { data } = await (selection === 'assigned'
        ? client.query({ ...options, query: SalesLeadAssignmentAgentsDocument })
        : client.query({
            ...options,
            query: SalesAgentsDocument,
            variables: { ids: Array.isArray(selection) ? selection : undefined },
          }));
      if (!data) {
        throw new Error('Missing Sales agents result');
      }
      return data.salesAgents;
    } finally {
      signal.removeEventListener('abort', stop);
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

  async updateAssignment(
    scope: SalesWorkspaceScope,
    id: string,
    assignedAgentUserId: string | null,
  ) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: SalesUpdateLeadAssignmentDocument,
        variables: { id, assignedAgentUserId },
        context: { language: scope.language },
      });
      if (!data) {
        throw new Error('Missing saved lead assignment');
      }
      return data.updateLeadAssignment;
    } finally {
      client.stop();
    }
  }
}
