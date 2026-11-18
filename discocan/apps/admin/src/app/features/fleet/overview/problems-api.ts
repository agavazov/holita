import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { EMPTY, expand, last, map, scan } from 'rxjs';
import {
  AdminDashboardProblemsDocument,
  AdminDashboardCurrentWarningsDocument,
  type AdminDashboardProblemsQueryVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

@Injectable()
export class ProblemsApi implements OnDestroy {
  private readonly http = inject(HttpLink);
  private readonly config = inject(AdminConfig);
  private readonly session = inject(DemoSession);
  private readonly zone = inject(NgZone);
  private client: ApolloBase | undefined;
  private destroyed = false;

  initialize(branchId: string, language: Language): void {
    if (this.client || this.destroyed) {
      throw new Error('ProblemsApi belongs to one workspace.');
    }
    this.client = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(
          this.http,
          this.config.graphqlUrl,
          { branchId, language },
          this.session.capture(),
        ),
      ),
    );
  }

  problems(variables: AdminDashboardProblemsQueryVariables) {
    return this.problemPage(variables, 0).pipe(
      expand((page) =>
        page.offset + page.limit < page.total
          ? this.problemPage(variables, page.offset + page.limit)
          : EMPTY,
      ),
      scan((previous, page) => ({ ...page, items: [...previous.items, ...page.items] })),
      last(),
    );
  }

  currentWarnings() {
    return this.warningPage(0).pipe(
      expand((page) =>
        page.offset + page.limit < page.total ? this.warningPage(page.offset + page.limit) : EMPTY,
      ),
      scan((previous, page) => ({ ...page, items: [...previous.items, ...page.items] })),
      last(),
    );
  }

  private problemPage(variables: AdminDashboardProblemsQueryVariables, offset: number) {
    return this.activeClient()
      .query({
        query: AdminDashboardProblemsDocument,
        variables: { ...variables, offset, limit: 100 },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Fleet problems are unavailable.');
          }
          return result.data.fleetProblems;
        }),
      );
  }

  private warningPage(offset: number) {
    return this.activeClient()
      .query({
        query: AdminDashboardCurrentWarningsDocument,
        variables: { offset, limit: 100 },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Current warnings are unavailable.');
          }
          return result.data.fleetVehicles;
        }),
      );
  }

  private activeClient(): ApolloBase {
    if (!this.client || this.destroyed) {
      throw new Error('An active Problems workspace is required.');
    }
    return this.client;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.client?.client.stop();
    this.client = undefined;
  }
}
