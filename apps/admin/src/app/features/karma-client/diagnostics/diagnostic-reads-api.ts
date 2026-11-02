import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminDiagnosticReadsDocument,
  AdminRequestDiagnosticReadDocument,
  type AdminDiagnosticReadsQueryVariables,
  type AdminRequestDiagnosticReadMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

@Injectable()
export class DiagnosticReadsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private submitting = false;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('DiagnosticReadsApi belongs to one Branch workspace.');
    }
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(
          this.httpLink,
          this.config.graphqlUrl,
          { branchId, language },
          this.session.capture(),
        ),
      ),
    );
  }

  watch(variables: AdminDiagnosticReadsQueryVariables) {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active diagnostic read workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminDiagnosticReadsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async request(input: AdminRequestDiagnosticReadMutationVariables['input']) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed || this.submitting) {
      throw new Error('An idle diagnostic read workspace is required.');
    }
    this.submitting = true;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminRequestDiagnosticReadDocument, variables: { input } }),
      );
      const operation = result.data?.requestFleetDeviceDiagnosticRead;
      if (!operation) {
        throw new Error('Missing requestFleetDeviceDiagnosticRead result.');
      }
      return operation;
    } finally {
      this.submitting = false;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private stopWhenIdle(): void {
    if (this.destroyed && !this.submitting) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
