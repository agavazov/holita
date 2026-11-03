import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { Language } from '../../i18n/messages';
import {
  AdminControlCenterDevicesDocument,
  AdminControlCenterDeviceDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterCommandsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterSendCommandDocument,
  type AdminControlCenterEventsQueryVariables,
  type AdminControlCenterCommandsQueryVariables,
  type AdminControlCenterFramesQueryVariables,
  type ErmDeviceAction,
  type ErmLanguage,
} from '../../../generated/graphql/operations';

/** Branch-scoped reads of Fleet Devices with their state on holita's device server. */
@Injectable()
export class ControlCenterApi implements OnDestroy {
  private readonly httpLink = inject(HttpLink);
  private readonly session = inject(DemoSession);
  private readonly config = inject(AdminConfig);
  private readonly zone = inject(NgZone);
  private apollo: ApolloBase | undefined;

  initialize(branchId: string, language: Language): void {
    if (this.apollo) {
      throw new Error('ControlCenterApi belongs to one branch workspace.');
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

  private client(): ApolloBase {
    if (!this.apollo) {
      throw new Error('An active Control center workspace is required.');
    }
    return this.apollo;
  }

  watchDevices(language: ErmLanguage) {
    return this.client().watchQuery({
      query: AdminControlCenterDevicesDocument,
      variables: { language },
      fetchPolicy: 'network-only',
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  watchDevice(id: string, language: ErmLanguage) {
    return this.client().watchQuery({
      query: AdminControlCenterDeviceDocument,
      variables: { id, language },
      fetchPolicy: 'network-only',
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  watchEvents(variables: AdminControlCenterEventsQueryVariables) {
    return this.client().watchQuery({
      query: AdminControlCenterEventsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchCommands(variables: AdminControlCenterCommandsQueryVariables) {
    return this.client().watchQuery({
      query: AdminControlCenterCommandsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  watchFrames(variables: AdminControlCenterFramesQueryVariables) {
    return this.client().watchQuery({
      query: AdminControlCenterFramesDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async sendCommand(deviceId: string, action: ErmDeviceAction) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterSendCommandDocument,
        variables: { input: { deviceId, action } },
      }),
    );
    if (!result.data?.sendErmDeviceCommand) {
      throw new Error('Missing sendErmDeviceCommand result.');
    }
    return result.data.sendErmDeviceCommand;
  }

  ngOnDestroy(): void {
    this.apollo?.client.stop();
  }
}
