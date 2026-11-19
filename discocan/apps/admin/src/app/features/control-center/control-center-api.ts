import { inject, Injectable, NgZone, type OnDestroy } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { ApolloBase } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { DemoSession } from '@osnova/ui/app';
import { AdminConfig } from '../../core/config/admin-config';
import { graphqlOptions } from '@osnova/ui/app';
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
  type RetryDeviceCommandInput,
  type StartDeviceCommandBatchInput,
  type StartDeviceParametersChangeInput,
  type StartDeviceConfigurationBatchInput,
  AdminControlCenterStartEdataChangeDocument,
  AdminControlCenterStartParameterChangeDocument,
  type StartDeviceMeasurementConfigurationChangeInput,
  type StartDeviceParameterChangeInput,
  AdminControlCenterDeviceDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterSendCommandDocument,
  AdminControlCenterCommandRequestsDocument,
  AdminControlCenterCommandRequestDocument,
  AdminControlCenterDeviceProblemsDocument,
  type AdminControlCenterDeviceProblemsQueryVariables,
  AdminControlCenterCancelCommandDocument,
  type SendDeviceCommandInput,
  AdminControlCenterSnapshotsDocument,
  AdminControlCenterStartSnapshotDocument,
  type AdminControlCenterEventsQueryVariables,
  type AdminControlCenterFramesQueryVariables,
  type AdminControlCenterSnapshotsQueryVariables,
  type FleetDeviceLanguage,
  type FleetDeviceType,
  AdminControlCenterParameterCatalogDocument,
  AdminControlCenterEdataProfilesDocument,
  AdminControlCenterEdataParametersDocument,
  AdminControlCenterActionCommandsDocument,
  type FleetDeviceParameterCatalogInput,
  type FleetEdataParametersInput,
} from '../../../generated/graphql/operations';

/** Branch-scoped reads of Fleet Devices and their provider state. */
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

  client(): ApolloBase {
    if (!this.apollo) {
      throw new Error('An active Control center workspace is required.');
    }
    return this.apollo;
  }

  watchDevice(id: string, language: FleetDeviceLanguage) {
    return this.client().watchQuery({
      query: AdminControlCenterDeviceDocument,
      variables: { id, language },
      errorPolicy: 'all',
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
  async startEdataChange(input: StartDeviceMeasurementConfigurationChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartEdataChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startDeviceMeasurementConfigurationChange) {
      throw new Error('Missing configuration change result.');
    }
    return result.data.startDeviceMeasurementConfigurationChange;
  }
  async startParameterChange(input: StartDeviceParameterChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParameterChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startDeviceParameterChange) {
      throw new Error('Missing configuration change result.');
    }
    return result.data.startDeviceParameterChange;
  }

  async startSnapshot(deviceId: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartSnapshotDocument,
        variables: { input: { deviceId } },
      }),
    );
    if (!result.data?.startDeviceParameterSnapshot) {
      throw new Error('Missing startDeviceParameterSnapshot result.');
    }
    return result.data.startDeviceParameterSnapshot;
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
    if (!result.data?.cancelDeviceCommand) {
      throw new Error('Missing cancelDeviceCommand result.');
    }
    return result.data.cancelDeviceCommand;
  }

  async sendCommand(input: SendDeviceCommandInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterSendCommandDocument,
        variables: { input },
      }),
    );
    if (!result.data?.sendDeviceCommand) {
      throw new Error('Missing sendDeviceCommand result.');
    }
    return result.data.sendDeviceCommand;
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

  async retryCommand(input: RetryDeviceCommandInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterRetryCommandDocument,
        variables: { input },
      }),
    );
    if (!result.data?.retryDeviceCommand) {
      throw new Error('Missing command retry result.');
    }
    return result.data.retryDeviceCommand;
  }

  async startCommandBatch(input: StartDeviceCommandBatchInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartCommandBatchDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startDeviceCommandBatch) {
      throw new Error('Missing command batch result.');
    }
    return result.data.startDeviceCommandBatch;
  }

  async stopCommandBatch(id: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStopCommandBatchDocument,
        variables: { id },
      }),
    );
    if (!result.data?.stopDeviceCommandBatch) {
      throw new Error('Missing command batch stop result.');
    }
    return result.data.stopDeviceCommandBatch;
  }

  async startParametersChange(input: StartDeviceParametersChangeInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParametersChangeDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startDeviceParametersChange) {
      throw new Error('Missing parameters change result.');
    }
    return result.data.startDeviceParametersChange;
  }

  async startParameterBatch(input: StartDeviceConfigurationBatchInput) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStartParameterBatchDocument,
        variables: { input },
      }),
    );
    if (!result.data?.startDeviceConfigurationBatch) {
      throw new Error('Missing parameter batch result.');
    }
    return result.data.startDeviceConfigurationBatch;
  }

  async stopConfigurationBatch(id: string) {
    const result = await firstValueFrom(
      this.client().mutate({
        mutation: AdminControlCenterStopConfigurationBatchDocument,
        variables: { id },
      }),
    );
    if (!result.data?.stopDeviceConfigurationBatch) {
      throw new Error('Missing configuration batch stop result.');
    }
    return result.data.stopDeviceConfigurationBatch;
  }

  async searchParameterCatalog(
    deviceType: FleetDeviceType,
    input: FleetDeviceParameterCatalogInput,
  ) {
    const result = await firstValueFrom(
      this.client().query({
        query: AdminControlCenterParameterCatalogDocument,
        variables: { deviceType, input },
      }),
    );
    if (!result.data) {
      throw new Error('Missing fleetDeviceParameterCatalog result.');
    }
    return result.data.fleetDeviceParameterCatalog;
  }

  async edataProfiles() {
    const result = await firstValueFrom(
      this.client().query({ query: AdminControlCenterEdataProfilesDocument }),
    );
    if (!result.data) {
      throw new Error('Missing fleetEdataProfiles result.');
    }
    return result.data.fleetEdataProfiles;
  }

  async searchEdataParameters(input: FleetEdataParametersInput) {
    const result = await firstValueFrom(
      this.client().query({
        query: AdminControlCenterEdataParametersDocument,
        variables: { input },
      }),
    );
    if (!result.data) {
      throw new Error('Missing fleetEdataParameters result.');
    }
    return result.data.fleetEdataParameters;
  }

  watchActionCommands(deviceType: FleetDeviceType) {
    return this.client().watchQuery({
      query: AdminControlCenterActionCommandsDocument,
      variables: { deviceType },
    });
  }

  async actionCommands(deviceType: FleetDeviceType) {
    const result = await firstValueFrom(
      this.client().query({
        query: AdminControlCenterActionCommandsDocument,
        variables: { deviceType },
      }),
    );
    if (!result.data) {
      throw new Error('Missing fleetDeviceActionCatalog result.');
    }
    return result.data.fleetDeviceActionCatalog;
  }

  ngOnDestroy(): void {
    this.apollo?.client.stop();
  }
}
