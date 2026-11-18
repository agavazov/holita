import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminFleetPreferencesDocument,
  AdminUpdateBranchNameDocument,
  AdminUpdateFleetSettingsDocument,
  type AdminUpdateBranchNameMutationVariables,
  type AdminUpdateFleetSettingsMutationVariables,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { AdminConfig } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import type { Language } from '../../../i18n/messages';

/** A mounted preferences reader or settings editor owns one captured client. */
@Injectable()
export class GeneralSettingsApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private destroyed = false;
  private pendingWrites = 0;

  initialize(branchId: string, language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('GeneralSettingsApi belongs to one Branch workspace.');
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

  watchPreferences() {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active General settings workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminFleetPreferencesDocument,
      fetchPolicy: 'network-only',
    });
  }

  async update(variables: AdminUpdateFleetSettingsMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active General settings workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateFleetSettingsDocument, variables }),
      );
      if (!result.data?.updateFleetSettings) {
        throw new Error('Missing updateFleetSettings result.');
      }
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'fleetSettings', broadcast: false });
      return result.data.updateFleetSettings;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async renameBranch(variables: AdminUpdateBranchNameMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active General settings workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({ mutation: AdminUpdateBranchNameDocument, variables }),
      );
      if (!result.data?.updateBranchName) {
        throw new Error('Missing updateBranchName result.');
      }
      apollo.client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'branches', broadcast: false });
      return result.data.updateBranchName;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
