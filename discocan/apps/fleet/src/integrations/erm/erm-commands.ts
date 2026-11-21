import {
  DEVICE_ACTIONS,
  parseDeviceCommandBatch,
  parseDeviceCommandRequest,
  parseDeviceCommandRequestsPage,
  parseDeviceCommandsPage,
  type CancelDeviceCommandRequest,
  type CreateDeviceCommandRequest,
  type DeviceAction,
  type DeviceCommandBatchLookup,
  type DeviceCommandHistoryRequest,
  type DeviceCommandRequestHistory,
  type DeviceCommandRequestLookup,
  type DeviceCommandRequestsQuery,
  type RetryDeviceCommandRequest,
  type StartDeviceCommandBatch,
  type StopDeviceCommandBatch,
} from '@discocan/device-contract';
import { Injectable } from '@nestjs/common';
import { recordOf, rowsOf, text, textOrNull } from '../../database/sql.js';
import type {
  FleetDeviceActionCatalogEntry,
  FleetDeviceCommandBatch,
  FleetDeviceCommandRequest,
} from '../../generated/graphql/types.js';
import type { InspectionCaller, InspectionDevice } from '../device-adapter.js';
import { ermCommand, ermCommandFields, stringList } from './erm-command-evidence.js';
import { ermConfigurationChange, ermConfigurationChangeFields } from './erm-configuration.js';
import { ermEntity, ermMutate, ermOperation } from './erm-api.js';
import { ermMessage, ermMessageFields } from './erm-inspection.js';

const requestFields = `
  id deviceId imei: unitId actorId cancelledByActorId batchId batchIndex retryOfId waitingReason
  waitingSince intent action parameters parameterValues { parameter title value resultCode outcome }
  actionCode displayParameters { expiresInSeconds requestedFields } requestedAt queuedAt submittingAt
  sentAt answeredAt failedAt expiredAt cancelledAt uncertainAt outcomeCode reasonCode
  transportCommand { ${ermCommandFields} }
  configurationVerification { ${ermConfigurationChangeFields} }
  sentFrame { ${ermMessageFields} } receivedFrameHex status createdAt expiresAt submittedAt
  completedAt commandId resultCode responseText failureReason
  faultReadVerdict { activeCodes codeCount receivedAt }
`;

const batchFields = `
  id actorId action createdAt stoppedAt stoppedByActorId counts { status count }
  requests { ${requestFields} }
`;

const listQuery = `query FleetCommandQueue($offset: Int!, $limit: Int!, $filter: ErmCommandRequestsFilter!, $sort: ErmCommandRequestsSort!) {
  ermCommandRequests(offset: $offset, limit: $limit, filter: $filter, sort: $sort) {
    total offset limit items { ${requestFields} }
  }
}`;

const requestHistoryQuery = `query FleetDeviceRequests($devices: [_Any!]!) {
  _entities(representations: $devices) {
    ... on FleetDevice { ermCommandRequests { ${requestFields} } }
  }
}`;

const commandHistoryQuery = `query FleetDeviceCommands($devices: [_Any!]!, $input: ErmDevicePageInput!) {
  _entities(representations: $devices) {
    ... on FleetDevice {
      ermCommands(input: $input) { cursor nextCursor hasMore items { ${ermCommandFields} } }
    }
  }
}`;

function ermAction(action: DeviceAction) {
  switch (action) {
    case 'READ_DIAGNOSTICS':
      return 'READ_EDATA_DIAGNOSTICS';
    case 'READ_FAULTS':
      return 'READ_EDATA_FAULTS';
    default:
      return action;
  }
}

function deviceAction(value: unknown): DeviceAction {
  const action = DEVICE_ACTIONS.find((action) => ermAction(action) === value);
  if (action === undefined) {
    throw new TypeError('Unknown ERM action');
  }
  return action;
}

function commandRequest(value: unknown): FleetDeviceCommandRequest {
  const row = recordOf(value);
  const parsed = parseDeviceCommandRequest(
    { ...row, action: deviceAction(row.action), actionCode: deviceAction(row.actionCode) },
    ermCommand,
  );
  const sentFrame = row.sentFrame === null ? null : ermMessage(recordOf(row.sentFrame));
  const receivedFrameHex = textOrNull(row, 'receivedFrameHex');
  const configurationVerification =
    row.configurationVerification === null
      ? null
      : ermConfigurationChange(row.configurationVerification);
  return {
    ...parsed,
    deviceType: 'ERM',
    erm: {
      sentFrame,
      receivedFrameHex,
      configurationVerificationId: configurationVerification?.id ?? null,
      configurationVerification,
    },
  };
}

function commandBatch(value: unknown): FleetDeviceCommandBatch {
  const row = recordOf(value);
  return {
    ...parseDeviceCommandBatch({ ...row, action: deviceAction(row.action) }, commandRequest),
    deviceType: 'ERM',
  };
}

@Injectable()
export class ErmCommands {
  createCommand(
    { device, action, parameters, expiresInSeconds, intent }: CreateDeviceCommandRequest,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'sendErmDeviceCommand',
      'SendErmDeviceCommandInput',
      {
        deviceId: device.id,
        action: ermAction(action),
        parameters,
        expiresInSeconds,
        intent,
      },
      requestFields,
      caller,
      commandRequest,
    );
  }

  listCommands(
    { offset, limit, filter, sort }: DeviceCommandRequestsQuery,
    caller: InspectionCaller,
  ) {
    return ermOperation(
      listQuery,
      {
        offset,
        limit,
        filter: { ...filter, actions: filter.actions?.map(ermAction) },
        sort,
      },
      'ermCommandRequests',
      caller,
      (value) => parseDeviceCommandRequestsPage(value, commandRequest),
    );
  }

  getCommand({ requestId }: DeviceCommandRequestLookup, caller: InspectionCaller) {
    return ermOperation(
      `query FleetCommandRequest($id: ID!) { ermCommandRequest(id: $id) { ${requestFields} } }`,
      { id: requestId },
      'ermCommandRequest',
      caller,
      (value) => (value === null ? null : commandRequest(value)),
    );
  }

  cancelCommand({ device, requestId }: CancelDeviceCommandRequest, caller: InspectionCaller) {
    return ermMutate(
      'cancelErmDeviceCommand',
      'CancelErmDeviceCommandInput',
      {
        deviceId: device.id,
        requestId,
      },
      requestFields,
      caller,
      commandRequest,
    );
  }

  retryCommand(
    { requestId, expiresInSeconds, intent }: RetryDeviceCommandRequest,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'retryErmDeviceCommand',
      'RetryErmDeviceCommandInput',
      {
        requestId,
        expiresInSeconds,
        intent,
      },
      requestFields,
      caller,
      commandRequest,
    );
  }

  startCommandBatch(
    { devices, action, expiresInSeconds, intent }: StartDeviceCommandBatch,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'startErmCommandBatch',
      'StartErmCommandBatchInput',
      {
        deviceIds: devices.map(({ id }) => id),
        action: ermAction(action),
        expiresInSeconds,
        intent,
      },
      batchFields,
      caller,
      commandBatch,
    );
  }

  getCommandBatch({ batchId }: DeviceCommandBatchLookup, caller: InspectionCaller) {
    return ermOperation(
      `query FleetCommandBatch($id: ID!) { ermCommandBatch(id: $id) { ${batchFields} } }`,
      { id: batchId },
      'ermCommandBatch',
      caller,
      (value) => (value === null ? null : commandBatch(value)),
    );
  }

  stopCommandBatch({ batchId }: StopDeviceCommandBatch, caller: InspectionCaller) {
    return ermOperation(
      `mutation FleetStopCommandBatch($id: ID!) { stopErmCommandBatch(id: $id) { ${batchFields} } }`,
      { id: batchId },
      'stopErmCommandBatch',
      caller,
      commandBatch,
    );
  }

  commandRequestHistory({ device }: DeviceCommandRequestHistory, caller: InspectionCaller) {
    return ermEntity(requestHistoryQuery, device, {}, 'ermCommandRequests', caller, (value) =>
      rowsOf(value, commandRequest),
    );
  }

  faultReadHistory(devices: readonly InspectionDevice[], caller: InspectionCaller) {
    return ermOperation(
      requestHistoryQuery,
      { devices: devices.map((device) => ({ __typename: 'FleetDevice', ...device })) },
      '_entities',
      caller,
      (value) => {
        if (!Array.isArray(value)) {
          throw new TypeError('Invalid ERM Device references');
        }
        return value.flatMap((entity: unknown) => {
          // ERM returns null for a Device that left the registry since Fleet selected it.
          if (entity === null) {
            return [];
          }
          return rowsOf(recordOf(entity).ermCommandRequests, commandRequest).filter(
            ({ action }) => action === 'READ_FAULTS',
          );
        });
      },
    );
  }

  commandHistory(
    { device, pageSize, offset, cursor }: DeviceCommandHistoryRequest,
    caller: InspectionCaller,
  ) {
    return ermEntity(
      commandHistoryQuery,
      device,
      { input: { pageSize, offset, cursor } },
      'ermCommands',
      caller,
      (value) => parseDeviceCommandsPage(value, ermCommand),
    );
  }

  async actionCatalog(caller: InspectionCaller): Promise<FleetDeviceActionCatalogEntry[]> {
    const fixed = await ermOperation(
      'query FleetDeviceActionCatalog { ermDeviceActionCommands { action command fields } }',
      {},
      'ermDeviceActionCommands',
      caller,
      (value) =>
        rowsOf(value, (row) => ({
          action: deviceAction(row.action),
          requiresParameters: false,
          erm: { command: text(row, 'command'), fields: stringList(row.fields) },
        })),
    );
    return [...fixed, { action: 'READ_PARAMETERS', requiresParameters: true, erm: null }];
  }
}
