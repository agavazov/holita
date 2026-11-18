import { inject, Injectable, NgZone } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminMarkAllNotificationsReadDocument,
  AdminMarkNotificationReadDocument,
  AdminNotificationsDocument,
  type AdminNotificationsQueryVariables,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';

/** The shell and feed share one captured session/Branch/language client. */
@Injectable()
export class NotificationsApi {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);

  connect(branchId: string, language: Language) {
    const session = this.session.capture();
    const apollo = new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, { branchId, language }, session),
      ),
    );
    let closed = false;
    let pendingWrites = 0;
    const stopWhenIdle = () => {
      if (closed && pendingWrites === 0) {
        apollo.client.stop();
      }
    };
    const refresh = () => {
      if (!closed) {
        // Includes both the latest bell items and any mounted filtered page.
        void apollo.client.refetchQueries({ include: 'active' }).catch(() => {
          // The active query subscriptions present their own errors and Retry controls.
        });
      }
    };
    return {
      branchId,
      language,
      token: session.token,
      watch: (variables: AdminNotificationsQueryVariables, poll = false) =>
        apollo.watchQuery({
          query: AdminNotificationsDocument,
          variables,
          fetchPolicy: 'network-only',
          ...(poll ? { pollInterval: 30_000, skipPollAttempt: () => document.hidden } : {}),
        }),
      markRead: async (id: string) => {
        pendingWrites++;
        try {
          await firstValueFrom(
            apollo.mutate({ mutation: AdminMarkNotificationReadDocument, variables: { id } }),
          );
          refresh();
        } finally {
          pendingWrites--;
          stopWhenIdle();
        }
      },
      markAllRead: async () => {
        pendingWrites++;
        try {
          await firstValueFrom(apollo.mutate({ mutation: AdminMarkAllNotificationsReadDocument }));
          refresh();
        } finally {
          pendingWrites--;
          stopWhenIdle();
        }
      },
      refresh,
      close: () => {
        closed = true;
        stopWhenIdle();
      },
    };
  }
}

export type NotificationsConnection = ReturnType<NotificationsApi['connect']>;
