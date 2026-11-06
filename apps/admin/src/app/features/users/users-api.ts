import { Injectable, NgZone, inject, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminCreateUserDocument,
  AdminDeactivateUserDocument,
  AdminFleetPreferencesDocument,
  AdminReactivateUserDocument,
  AdminUpdateUserDocument,
  AdminUsersDocument,
  type AdminCreateUserMutationVariables,
  type AdminUpdateUserMutationVariables,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';
import { errorCode } from '../../ui/forms/field-errors';

/** One captured organization session and language, independent of the selected Branch. */
@Injectable()
export class UsersApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;
  private language: Language = 'en';
  private capturedSession: ReturnType<DemoSession['capture']> | null = null;
  private destroyed = false;
  private pendingWrites = 0;

  get token(): string | null {
    return this.capturedSession?.token ?? null;
  }

  initialize(language: Language): void {
    if (this.apollo || this.destroyed) {
      throw new Error('UsersApi belongs to one account workspace.');
    }
    const session = this.session.capture();
    this.capturedSession = session;
    this.language = language;
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, session),
    );
    this.apollo = new ApolloBase(this.zone, undefined, client);
  }

  watch() {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Users workspace is required.');
    }
    return this.apollo.watchQuery({
      query: AdminUsersDocument,
      fetchPolicy: 'network-only',
      context: { language: this.language },
    });
  }

  watchDisplayPreferences(branchId: string, language: Language) {
    const session = this.capturedSession;
    if (!session || this.destroyed) {
      throw new Error('An active Users workspace is required.');
    }
    const client = new ApolloClient(
      graphqlOptions(this.httpLink, this.config.graphqlUrl, { branchId, language }, session),
    );
    const apollo = new ApolloBase(this.zone, undefined, client);
    return {
      query: apollo.watchQuery({
        query: AdminFleetPreferencesDocument,
        fetchPolicy: 'network-only',
      }),
      close: () => {
        client.stop();
      },
    };
  }

  async create(variables: AdminCreateUserMutationVariables) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminCreateUserDocument,
          variables,
          context: { language: this.language },
        }),
      );
      if (!result.data?.createUser) {
        throw new Error('Missing createUser result.');
      }
      return result.data.createUser;
    } catch (error: unknown) {
      this.expireUnauthorized(error);
      throw error;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async update(variables: AdminUpdateUserMutationVariables) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminUpdateUserDocument,
          variables,
          context: { language: this.language },
        }),
      );
      if (!result.data?.updateUser) {
        throw new Error('Missing updateUser result.');
      }
      return result.data.updateUser;
    } catch (error: unknown) {
      this.expireUnauthorized(error);
      throw error;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async deactivate(id: string) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminDeactivateUserDocument,
          variables: { id },
          context: { language: this.language },
        }),
      );
      if (!result.data?.deactivateUser) {
        throw new Error('Missing deactivateUser result.');
      }
      return result.data.deactivateUser;
    } catch (error: unknown) {
      this.expireUnauthorized(error);
      throw error;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  async reactivate(id: string) {
    const apollo = this.active();
    this.pendingWrites++;
    try {
      const result = await firstValueFrom(
        apollo.mutate({
          mutation: AdminReactivateUserDocument,
          variables: { id },
          context: { language: this.language },
        }),
      );
      if (!result.data?.reactivateUser) {
        throw new Error('Missing reactivateUser result.');
      }
      return result.data.reactivateUser;
    } catch (error: unknown) {
      this.expireUnauthorized(error);
      throw error;
    } finally {
      this.pendingWrites--;
      this.stopWhenIdle();
    }
  }

  expireUnauthorized(error: unknown): void {
    if (errorCode(error) === 'UNAUTHENTICATED' && this.capturedSession) {
      this.session.expire(this.capturedSession.token);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWhenIdle();
  }

  private active(): ApolloBase {
    if (!this.apollo || this.destroyed) {
      throw new Error('An active Users workspace is required.');
    }
    return this.apollo;
  }

  private stopWhenIdle(): void {
    if (this.destroyed && this.pendingWrites === 0) {
      this.apollo?.client.stop();
      this.apollo = undefined;
    }
  }
}
