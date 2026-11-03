import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import {
  AdminErmUnitsDocument,
  AdminErmEventsDocument,
  AdminErmFramesDocument,
  AdminErmCommandsDocument,
  type ErmHistoryInput,
  type ErmUnitsInput,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';

@Injectable()
export class ErmApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;

  private client(): ApolloBase {
    this.apollo ??= new ApolloBase(
      this.zone,
      undefined,
      new ApolloClient(
        graphqlOptions(this.httpLink, this.config.graphqlUrl, undefined, this.session.capture()),
      ),
    );
    return this.apollo;
  }

  watchUnits(input: ErmUnitsInput, language: Language) {
    return this.client().watchQuery({
      query: AdminErmUnitsDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language },
    });
  }

  watchEvents(input: ErmHistoryInput, language: Language) {
    return this.client().watchQuery({
      query: AdminErmEventsDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language },
    });
  }

  watchFrames(input: ErmHistoryInput, language: Language) {
    return this.client().watchQuery({
      query: AdminErmFramesDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language },
    });
  }

  watchCommands(input: ErmHistoryInput, language: Language) {
    return this.client().watchQuery({
      query: AdminErmCommandsDocument,
      variables: { input },
      fetchPolicy: 'network-only',
      context: { language },
    });
  }

  ngOnDestroy(): void {
    this.apollo?.client.stop();
  }
}
