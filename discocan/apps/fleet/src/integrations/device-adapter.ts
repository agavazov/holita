import type {
  DeviceConfigurationBatchLookup,
  DeviceConfigurationHistoryQuery,
  DeviceConfigurationOutcome,
  DeviceParameterCatalogQuery,
  DeviceParameterSnapshotsQuery,
  StartDeviceConfigurationBatch,
  StartDeviceMeasurementConfigurationChange,
  StartDeviceParameterChange,
  StartDeviceParameterSnapshot,
  StartDeviceParametersChange,
  StopDeviceConfigurationBatch,
  CancelDeviceCommandRequest,
  CreateDeviceCommandRequest,
  DeviceAcknowledgement,
  DeviceAnsweredFaultRead,
  DeviceAnsweredFaultReads,
  DeviceAnsweredFaultReadsQuery,
  DeviceCommandBatchLookup,
  DeviceCommandHistoryRequest,
  DeviceCommandOutcome,
  DeviceCommandRequestHistory,
  DeviceCommandRequestLookup,
  DeviceCommandRequestsQuery,
  DeviceCommandScope,
  DeviceFaultReadRequest,
  RetryDeviceCommandRequest,
  StartDeviceCommandBatch,
  StopDeviceCommandBatch,
  DeviceEvent,
  DeviceEventsRequest,
  DeviceLiveSnapshot,
  DeviceMessage,
  DeviceMessagesRequest,
  DeviceNotificationPage,
  DeviceNotificationsRequest,
  DeviceProblemPage,
  DeviceProblemRequest,
  DeviceReportPage,
  DevicePage,
  DeviceState,
} from '@discocan/device-contract';
import type {
  FleetDeviceConfigurationBatch,
  FleetDeviceConfigurationChange,
  FleetDeviceParameterCatalogPage,
  FleetDeviceParameterSnapshot,
  FleetDeviceParameterSnapshotsPage,
  FleetDeviceActionCatalogEntry,
  FleetDeviceCommandBatch,
  FleetDeviceCommandRequest,
  FleetDeviceCommandRequestsPage,
  FleetDeviceCommandsPage,
  FleetErmDeviceAcknowledgement,
  FleetErmDeviceEvent,
  FleetErmDeviceMessage,
  FleetErmDeviceState,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';

export interface InspectionDevice {
  id: string;
  imei: string;
}

export type InspectionCaller = Pick<RequestContext, 'authorization' | 'branchId'>;
export type InspectionEvent = DeviceEvent & { erm?: FleetErmDeviceEvent };
export type InspectionMessage = Omit<DeviceMessage, 'acknowledgement'> & {
  acknowledgement: (DeviceAcknowledgement & { erm?: FleetErmDeviceAcknowledgement }) | null;
  erm?: FleetErmDeviceMessage;
};
export type InspectionState = Omit<
  DeviceState,
  'latestPosition' | 'latestEvent' | 'latestAlarm'
> & {
  latestPosition: InspectionEvent | null;
  latestEvent: InspectionEvent | null;
  latestAlarm: InspectionEvent | null;
  erm?: FleetErmDeviceState;
};

export interface DeviceAdapter {
  states(
    devices: readonly InspectionDevice[],
    caller: InspectionCaller,
  ): Promise<InspectionState[]>;
  events(
    device: InspectionDevice,
    input: DeviceEventsRequest,
    caller: InspectionCaller,
  ): Promise<DevicePage<InspectionEvent>>;
  messages(
    device: InspectionDevice,
    input: DeviceMessagesRequest,
    caller: InspectionCaller,
  ): Promise<DevicePage<InspectionMessage>>;
  createCommand(
    request: CreateDeviceCommandRequest,
    caller: InspectionCaller,
  ): Promise<DeviceCommandOutcome<FleetDeviceCommandRequest>>;
  listCommands(
    request: DeviceCommandRequestsQuery,
    caller: InspectionCaller,
  ): Promise<FleetDeviceCommandRequestsPage>;
  getCommand(
    request: DeviceCommandRequestLookup,
    caller: InspectionCaller,
  ): Promise<FleetDeviceCommandRequest | null>;
  cancelCommand(
    request: CancelDeviceCommandRequest,
    caller: InspectionCaller,
  ): Promise<DeviceCommandOutcome<FleetDeviceCommandRequest>>;
  retryCommand(
    request: RetryDeviceCommandRequest,
    caller: InspectionCaller,
  ): Promise<DeviceCommandOutcome<FleetDeviceCommandRequest>>;
  startCommandBatch(
    request: StartDeviceCommandBatch,
    caller: InspectionCaller,
  ): Promise<DeviceCommandOutcome<FleetDeviceCommandBatch>>;
  getCommandBatch(
    request: DeviceCommandBatchLookup,
    caller: InspectionCaller,
  ): Promise<FleetDeviceCommandBatch | null>;
  stopCommandBatch(
    request: StopDeviceCommandBatch,
    caller: InspectionCaller,
  ): Promise<DeviceCommandOutcome<FleetDeviceCommandBatch>>;
  commandRequestHistory(
    request: DeviceCommandRequestHistory,
    caller: InspectionCaller,
  ): Promise<FleetDeviceCommandRequest[]>;
  commandHistory(
    request: DeviceCommandHistoryRequest,
    caller: InspectionCaller,
  ): Promise<FleetDeviceCommandsPage>;
  actionCatalog(
    request: DeviceCommandScope,
    caller: InspectionCaller,
  ): Promise<FleetDeviceActionCatalogEntry[]>;
  startParameterSnapshot(
    request: StartDeviceParameterSnapshot,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceParameterSnapshot>>;
  parameterSnapshots(
    request: DeviceParameterSnapshotsQuery,
    caller: InspectionCaller,
  ): Promise<FleetDeviceParameterSnapshotsPage>;
  parameterCatalog(
    request: DeviceParameterCatalogQuery & { ermFeature?: string },
    caller: InspectionCaller,
  ): Promise<FleetDeviceParameterCatalogPage>;
  configurationChanges(
    request: DeviceConfigurationHistoryQuery,
    caller: InspectionCaller,
  ): Promise<FleetDeviceConfigurationChange[]>;
  configurationWritesEnabled(
    request: DeviceConfigurationHistoryQuery,
    caller: InspectionCaller,
  ): Promise<boolean>;
  startMeasurementConfigurationChange(
    request: StartDeviceMeasurementConfigurationChange,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceConfigurationChange>>;
  startParameterChange(
    request: StartDeviceParameterChange,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceConfigurationChange>>;
  startParametersChange(
    request: StartDeviceParametersChange,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceConfigurationChange>>;
  startConfigurationBatch(
    request: StartDeviceConfigurationBatch,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceConfigurationBatch>>;
  getConfigurationBatch(
    request: DeviceConfigurationBatchLookup,
    caller: InspectionCaller,
  ): Promise<FleetDeviceConfigurationBatch | null>;
  stopConfigurationBatch(
    request: StopDeviceConfigurationBatch,
    caller: InspectionCaller,
  ): Promise<DeviceConfigurationOutcome<FleetDeviceConfigurationBatch>>;
  requestFaultRead(request: DeviceFaultReadRequest): Promise<boolean>;
  answeredFaultReads(
    request: DeviceAnsweredFaultReadsQuery,
    caller: InspectionCaller,
  ): Promise<DeviceAnsweredFaultReads>;
  reports(imei: string, after: bigint): Promise<DeviceReportPage>;
  liveStates(imeis: readonly string[]): Promise<DeviceLiveSnapshot>;
  problems(request: DeviceProblemRequest): Promise<DeviceProblemPage>;
  notifications(request: DeviceNotificationsRequest): Promise<DeviceNotificationPage>;
}

export function newestAnsweredFaultReads(items: DeviceAnsweredFaultRead[], count: number) {
  return items
    .sort(
      (left, right) =>
        right.completedAt.getTime() - left.completedAt.getTime() || right.id.localeCompare(left.id),
    )
    .slice(0, count);
}
