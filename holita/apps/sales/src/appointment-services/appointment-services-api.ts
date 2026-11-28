import { inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorConfig, graphqlOptions } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  SalesAppointmentServiceDocument,
  SalesAppointmentServicesDocument,
  SalesCreateAppointmentServiceDocument,
  SalesUpdateAppointmentServiceDocument,
  type AppointmentServiceInput,
  type SalesAppointmentServicesQueryVariables,
} from '../generated/appointment-services-operations';
import { SalesWorkspaceApi, type SalesWorkspaceScope } from '../workspace/sales-workspace-api';

@Injectable({ providedIn: 'root' })
export class AppointmentServicesApi {
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  readonly scope = inject(SalesWorkspaceApi).scope;

  async list(
    scope: SalesWorkspaceScope,
    variables: SalesAppointmentServicesQueryVariables,
    signal: AbortSignal,
  ) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesAppointmentServicesDocument,
          variables,
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.appointmentServices;
  }

  async find(scope: SalesWorkspaceScope, id: string, signal: AbortSignal) {
    const data = await this.request(
      scope,
      (client, context) =>
        client.query({
          query: SalesAppointmentServiceDocument,
          variables: { id },
          fetchPolicy: 'no-cache',
          context,
        }),
      signal,
    );
    return data.appointmentService;
  }

  async save(scope: SalesWorkspaceScope, input: AppointmentServiceInput, id: string | null) {
    if (id) {
      const { updateAppointmentService } = await this.request(scope, (client, context) =>
        client.mutate({
          mutation: SalesUpdateAppointmentServiceDocument,
          variables: { id, input },
          context,
        }),
      );
      return updateAppointmentService.id;
    }
    const { createAppointmentService } = await this.request(scope, (client, context) =>
      client.mutate({
        mutation: SalesCreateAppointmentServiceDocument,
        variables: { input },
        context,
      }),
    );
    return createAppointmentService.id;
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
        throw new Error('Missing appointment service result');
      }
      return data;
    } finally {
      signal?.removeEventListener('abort', stop);
      client.stop();
    }
  }
}
