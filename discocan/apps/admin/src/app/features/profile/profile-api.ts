import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminChangePasswordDocument,
  AdminProfileDocument,
  AdminUpdateProfileDocument,
  type AdminChangePasswordMutationVariables,
  type AdminUpdateProfileMutationVariables,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';

/** One mounted account workspace owns its captured session and language. */
@Injectable()
export class ProfileApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private language: Language = 'en';
  private destroyed = false;
  private pendingWrites = 0;

  initialize(language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('ProfileApi belongs to one account workspace.');
    }
    this.language = language;
    this.apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, this.session.capture()),
      ),
    );
  }

  async load() {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Profile workspace is required.');
    }
    const result = await firstValueFrom(
      this.apollo.query({
        query: AdminProfileDocument,
        context: { language: this.language },
        fetchPolicy: 'network-only',
      }),
    );
    if (!result.data?.me) {
      throw new Error('Missing me result.');
    }
    return result.data.me;
  }

  async update(variables: AdminUpdateProfileMutationVariables) {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Profile workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminUpdateProfileDocument,
          variables,
          context: { language: this.language },
        }),
      );
      if (!result.data?.updateProfile) {
        throw new Error('Missing updateProfile result.');
      }
      return result.data.updateProfile;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async changePassword(variables: AdminChangePasswordMutationVariables): Promise<void> {
    const apollo = this.apollo;
    if (!apollo || this.destroyed) {
      throw new Error('An active Profile workspace is required.');
    }
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminChangePasswordDocument,
          variables,
          context: { language: this.language },
        }),
      );
      if (!result.data?.changePassword) {
        throw new Error('Missing changePassword result.');
      }
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
