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
  AdminControlCenterBranchCommandRequestsDocument,
  AdminControlCenterRetryCommandDocument,
  AdminControlCenterCommandBatchDocument,
  AdminControlCenterStartCommandBatchDocument,
  AdminControlCenterStopCommandBatchDocument,
  AdminControlCenterParameterBaselineDocument,
  AdminControlCenterSettingsDevicesDocument,
  AdminControlCenterQueueDeviceLabelsDocument,
  AdminControlCenterConfigurationBatchDocument,
  AdminControlCenterStartParametersChangeDocument,
  AdminControlCenterStartParameterBatchDocument,
  AdminControlCenterStopConfigurationBatchDocument,
  type AdminControlCenterBranchCommandRequestsQueryVariables,
  type RetryErmDeviceCommandInput,
  type StartErmCommandBatchInput,
  type StartErmParametersChangeInput,
  type StartErmParameterBatchInput,
  AdminControlCenterStartEdataChangeDocument,
  AdminControlCenterStartParameterChangeDocument,
  type StartErmEdataChangeInput,
  type StartErmParameterChangeInput,
  AdminControlCenterDevicesDocument,
  AdminControlCenterDeviceDocument,
  AdminControlCenterReturnToDiscoCanDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterCommandsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterSendCommandDocument,
  AdminControlCenterCommandRequestsDocument,
  AdminControlCenterCommandRequestDocument,
  AdminControlCenterDeviceProblemsDocument,
  type AdminControlCenterDeviceProblemsQueryVariables,
  AdminControlCenterCancelCommandDocument,
  type SendErmDeviceCommandInput,
  AdminControlCenterSnapshotsDocument,
  AdminControlCenterStartSnapshotDocument,
  AdminControlCenterSmsDevicesDocument,
  type AdminControlCenterEventsQueryVariables,
  type AdminControlCenterCommandsQueryVariables,
  type AdminControlCenterFramesQueryVariables,
  type AdminControlCenterSnapshotsQueryVariables,
  type ErmLanguage,
} from '../../../generated/graphql/operations';

/** Branch-scoped reads of Fleet Devices with their state on discocan's device server. */
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

  async returnToDiscoCan(deviceId: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterReturnToDiscoCanDocument,
        variables: { deviceId },
      }),
    );
    if (!result.data?.returnErmDeviceToDiscoCan) {
      throw new Error('Missing returnErmDeviceToDiscoCan result.');
    }
    return result.data.returnErmDeviceToDiscoCan;
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

  watchCommandRequests(id: string, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterCommandRequestsDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  watchCommandRequest(id: string, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterCommandRequestDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  watchDeviceProblems(variables: AdminControlCenterDeviceProblemsQueryVariables) {
    return this.client().watchQuery({
      query: AdminControlCenterDeviceProblemsDocument,
      variables,
      fetchPolicy: 'network-only',
    });
  }

  async cancelCommand(deviceId: string, requestId: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterCancelCommandDocument,
        variables: { input: { deviceId, requestId } },
      }),
    );
    if (!result.data?.cancelErmDeviceCommand) {
      throw new Error('Missing cancelErmDeviceCommand result.');
    }
    return result.data.cancelErmDeviceCommand;
  }

  async sendCommand(input: SendErmDeviceCommandInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterSendCommandDocument,
        variables: { input },
      }),
    );
    if (!result.data?.sendErmDeviceCommand) {
      throw new Error('Missing sendErmDeviceCommand result.');
    }
    return result.data.sendErmDeviceCommand;
  }

  watchBranchCommandRequests(
    variables: AdminControlCenterBranchCommandRequestsQueryVariables,
    skipPoll: () => boolean = () => false,
  ) {
    return this.client().watchQuery({
      query: AdminControlCenterBranchCommandRequestsDocument,
      variables,
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  watchQueueDeviceLabels(ids: string[]) {
    return this.client().watchQuery({
      query: AdminControlCenterQueueDeviceLabelsDocument,
      variables: { ids },
      fetchPolicy: 'network-only',
    });
  }

  watchQueueDevices(offset = 0) {
    return this.watchSettingsDevices(offset);
  }

  watchSettingsDevices(offset = 0) {
    return this.client().watchQuery({
      query: AdminControlCenterSettingsDevicesDocument,
      variables: { offset },
      fetchPolicy: 'network-only',
    });
  }

  watchParameterBaseline(id: string) {
    return this.client().watchQuery({
      query: AdminControlCenterParameterBaselineDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    });
  }

  watchCommandBatch(id: string, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterCommandBatchDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  watchConfigurationBatch(id: string, skipPoll: () => boolean) {
    return this.client().watchQuery({
      query: AdminControlCenterConfigurationBatchDocument,
      variables: { id },
      fetchPolicy: 'network-only',
      pollInterval: 5_000,
      skipPollAttempt: () => document.hidden || skipPoll(),
    });
  }

  async retryCommand(input: RetryErmDeviceCommandInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterRetryCommandDocument,
        variables: { input },
      }),
    );
    if (!result.data?.retryErmDeviceCommand) {
      throw new Error('Missing command retry result.');
    }
    return result.data.retryErmDeviceCommand;
  }

  async startCommandBatch(input: StartErmCommandBatchInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartCommandBatchDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startErmCommandBatch) {
      throw new Error('Missing command batch result.');
    }
    return result.data.startErmCommandBatch;
  }

  async stopCommandBatch(id: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStopCommandBatchDocument,
        variables: { id },
      }),
    );
    if (!result.data?.stopErmCommandBatch) {
      throw new Error('Missing command batch stop result.');
    }
    return result.data.stopErmCommandBatch;
  }

  async startParametersChange(input: StartErmParametersChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParametersChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startErmParametersChange) {
      throw new Error('Missing parameters change result.');
    }
    return result.data.startErmParametersChange;
  }

  async startParameterBatch(input: StartErmParameterBatchInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParameterBatchDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startErmParameterBatch) {
      throw new Error('Missing parameter batch result.');
    }
    return result.data.startErmParameterBatch;
  }

  async stopConfigurationBatch(id: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStopConfigurationBatchDocument,
        variables: { id },
      }),
    );
    if (!result.data?.stopErmConfigurationBatch) {
      throw new Error('Missing configuration batch stop result.');
    }
    return result.data.stopErmConfigurationBatch;
  }

  ngOnDestroy(): void {
    this.apollo?.client.stop();
  }
}
