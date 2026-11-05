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
  AdminControlCenterConfigurationChangesDocument,
  AdminControlCenterStartEdataChangeDocument,
  AdminControlCenterStartParameterChangeDocument,
  type StartErmEdataChangeInput,
  type StartErmParameterChangeInput,
  AdminControlCenterDevicesDocument,
  AdminControlCenterDeviceDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterCommandsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterSendCommandDocument,
  AdminControlCenterSnapshotsDocument,
  AdminControlCenterStartSnapshotDocument,
  AdminControlCenterSmsDevicesDocument,
  type AdminControlCenterEventsQueryVariables,
  type AdminControlCenterCommandsQueryVariables,
  type AdminControlCenterFramesQueryVariables,
  type AdminControlCenterSnapshotsQueryVariables,
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
      errorPolicy: 'all',
      fetchPolicy: 'network-only',
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  watchDevice(id: string, language: ErmLanguage) {
    return this.client().watchQuery({
      query: AdminControlCenterDeviceDocument,
      variables: { id, language },
      errorPolicy: 'all',
      fetchPolicy: 'network-only',
      pollInterval: 30_000,
      skipPollAttempt: () => document.hidden,
    });
  }

  watchSmsDevices(deviceId: string | null = null) {
    return this.client().watchQuery({
      query: AdminControlCenterSmsDevicesDocument,
      variables: { ids: deviceId ? [deviceId] : undefined },
      fetchPolicy: 'network-only',
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

  /** Polls every 5 seconds while `skipPoll` says a snapshot is still running. */
  watchSnapshots(variables: AdminControlCenterSnapshotsQueryVariables, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterSnapshotsDocument,
      variables,
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  watchConfigurationChanges(id: string, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterConfigurationChangesDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }
  async startEdataChange(input: StartErmEdataChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartEdataChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startErmEdataChange) {
      throw new Error('Missing configuration change result.');
    }
    return result.data.startErmEdataChange;
  }
  async startParameterChange(input: StartErmParameterChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParameterChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startErmParameterChange) {
      throw new Error('Missing configuration change result.');
    }
    return result.data.startErmParameterChange;
  }

  async startSnapshot(deviceId: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartSnapshotDocument,
        variables: { input: { deviceId } },
      }),
    );
    if (!result.data?.startErmParameterSnapshot) {
      throw new Error('Missing startErmParameterSnapshot result.');
    }
    return result.data.startErmParameterSnapshot;
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
