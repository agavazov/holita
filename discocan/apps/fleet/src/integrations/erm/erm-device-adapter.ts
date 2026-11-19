import { Injectable } from '@nestjs/common';
import type {
  DeviceConfigurationBatchLookup,
  DeviceConfigurationHistoryQuery,
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
  DeviceAnsweredFaultReadsQuery,
  DeviceCommandBatchLookup,
  DeviceCommandHistoryRequest,
  DeviceCommandRequestHistory,
  DeviceCommandRequestLookup,
  DeviceCommandRequestsQuery,
  DeviceCommandScope,
  DeviceFaultReadRequest,
  RetryDeviceCommandRequest,
  StartDeviceCommandBatch,
  StopDeviceCommandBatch,
  DeviceEventsRequest,
  DeviceLiveSnapshot,
  DeviceMessagesRequest,
  DeviceNotificationPage,
  DeviceNotificationsRequest,
  DeviceProblemPage,
  DeviceProblemRequest,
  DeviceReportPage,
} from '@discocan/device-contract';
import type { DeviceAdapter, InspectionCaller, InspectionDevice } from '../device-adapter.js';
import { ErmCommands } from './erm-commands.js';
import { ErmConfiguration } from './erm-configuration.js';
import { ErmFaultReads } from './erm-fault-reads.js';
import { ErmInspection } from './erm-inspection.js';
import { ErmNotifications } from './erm-notifications.js';
import { ErmReports } from './erm-reports.js';
import { ermDeviceProblems, ermLiveSnapshot, ErmStatus } from './erm-status.js';

@Injectable()
export class ErmDeviceAdapter implements DeviceAdapter {
  constructor(
    private readonly reportFeed: ErmReports,
    private readonly status: ErmStatus,
    private readonly notificationFeed: ErmNotifications,
    private readonly faultReads: ErmFaultReads,
    private readonly inspection: ErmInspection,
    private readonly commands: ErmCommands,
    private readonly configuration: ErmConfiguration,
  ) {}

  states(devices: readonly InspectionDevice[], caller: InspectionCaller) {
    return this.inspection.states(devices, caller);
  }

  events(device: InspectionDevice, input: DeviceEventsRequest, caller: InspectionCaller) {
    return this.inspection.events(device, input, caller);
  }

  messages(device: InspectionDevice, input: DeviceMessagesRequest, caller: InspectionCaller) {
    return this.inspection.messages(device, input, caller);
  }

  createCommand(request: CreateDeviceCommandRequest, caller: InspectionCaller) {
    return this.commands.createCommand(request, caller);
  }

  listCommands(request: DeviceCommandRequestsQuery, caller: InspectionCaller) {
    return this.commands.listCommands(request, caller);
  }

  getCommand(request: DeviceCommandRequestLookup, caller: InspectionCaller) {
    return this.commands.getCommand(request, caller);
  }

  cancelCommand(request: CancelDeviceCommandRequest, caller: InspectionCaller) {
    return this.commands.cancelCommand(request, caller);
  }

  retryCommand(request: RetryDeviceCommandRequest, caller: InspectionCaller) {
    return this.commands.retryCommand(request, caller);
  }

  startCommandBatch(request: StartDeviceCommandBatch, caller: InspectionCaller) {
    return this.commands.startCommandBatch(request, caller);
  }

  getCommandBatch(request: DeviceCommandBatchLookup, caller: InspectionCaller) {
    return this.commands.getCommandBatch(request, caller);
  }

  stopCommandBatch(request: StopDeviceCommandBatch, caller: InspectionCaller) {
    return this.commands.stopCommandBatch(request, caller);
  }

  commandRequestHistory(request: DeviceCommandRequestHistory, caller: InspectionCaller) {
    return this.commands.commandRequestHistory(request, caller);
  }

  commandHistory(request: DeviceCommandHistoryRequest, caller: InspectionCaller) {
    return this.commands.commandHistory(request, caller);
  }

  actionCatalog(_scope: DeviceCommandScope, caller: InspectionCaller) {
    return this.commands.actionCatalog(caller);
  }

  startParameterSnapshot(request: StartDeviceParameterSnapshot, caller: InspectionCaller) {
    return this.configuration.startParameterSnapshot(request, caller);
  }

  parameterSnapshots(request: DeviceParameterSnapshotsQuery, caller: InspectionCaller) {
    return this.configuration.parameterSnapshots(request, caller);
  }

  parameterCatalog(
    request: DeviceParameterCatalogQuery & { ermFeature?: string },
    caller: InspectionCaller,
  ) {
    return this.configuration.parameterCatalog(request, caller);
  }

  configurationChanges(request: DeviceConfigurationHistoryQuery, caller: InspectionCaller) {
    return this.configuration.configurationChanges(request, caller);
  }

  configurationWritesEnabled(request: DeviceConfigurationHistoryQuery, caller: InspectionCaller) {
    return this.configuration.configurationWritesEnabled(request, caller);
  }

  startMeasurementConfigurationChange(
    request: StartDeviceMeasurementConfigurationChange,
    caller: InspectionCaller,
  ) {
    return this.configuration.startMeasurementConfigurationChange(request, caller);
  }

  startParameterChange(request: StartDeviceParameterChange, caller: InspectionCaller) {
    return this.configuration.startParameterChange(request, caller);
  }

  startParametersChange(request: StartDeviceParametersChange, caller: InspectionCaller) {
    return this.configuration.startParametersChange(request, caller);
  }

  startConfigurationBatch(request: StartDeviceConfigurationBatch, caller: InspectionCaller) {
    return this.configuration.startConfigurationBatch(request, caller);
  }

  getConfigurationBatch(request: DeviceConfigurationBatchLookup, caller: InspectionCaller) {
    return this.configuration.getConfigurationBatch(request, caller);
  }

  stopConfigurationBatch(request: StopDeviceConfigurationBatch, caller: InspectionCaller) {
    return this.configuration.stopConfigurationBatch(request, caller);
  }

  requestFaultRead(request: DeviceFaultReadRequest) {
    return this.faultReads.requestFaultRead(request);
  }

  answeredFaultReads(
    { deviceIds, from, to, count }: DeviceAnsweredFaultReadsQuery,
    caller: InspectionCaller,
  ) {
    return this.faultReads.faultReads(caller, { deviceIds, from, to }, count);
  }

  reports(imei: string, after: bigint): Promise<DeviceReportPage> {
    return this.reportFeed.reports(imei, after);
  }

  async liveStates(imeis: readonly string[]): Promise<DeviceLiveSnapshot> {
    const snapshot = await this.status.telemetry(imeis);
    return ermLiveSnapshot(snapshot);
  }

  async problems({
    imeis,
    from,
    to,
    offset,
    limit,
    ...scope
  }: DeviceProblemRequest): Promise<DeviceProblemPage> {
    const page = await this.status.problems(scope, imeis, { from, to }, { offset, limit });
    return ermDeviceProblems(page);
  }

  notifications(request: DeviceNotificationsRequest): Promise<DeviceNotificationPage> {
    return this.notificationFeed.notifications(request);
  }
}
