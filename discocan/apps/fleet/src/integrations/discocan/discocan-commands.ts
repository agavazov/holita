import {
  DEVICE_SERVER_ROUTES,
  parseDeviceActionCatalog,
  parseDeviceAnsweredFaultReads,
  parseDeviceCommand,
  parseDeviceCommandBatch,
  parseDeviceCommandLookup,
  parseDeviceCommandOutcome,
  parseDeviceCommandRequest,
  parseDeviceCommandRequestHistoryResult,
  parseDeviceCommandRequestsPage,
  parseDeviceCommandsPage,
  parseDeviceFaultReadOutcome,
  type CancelDeviceCommandRequest,
  type CreateDeviceCommandRequest,
  type DeviceAnsweredFaultReads,
  type DeviceAnsweredFaultReadsQuery,
  type DeviceCommandBatchLookup,
  type DeviceCommandHistoryRequest,
  type DeviceCommandRequestHistory,
  type DeviceCommandRequestLookup,
  type DeviceCommandRequestsQuery,
  type DeviceCommandScope,
  type DeviceFaultReadRequest,
  type RetryDeviceCommandRequest,
  type StartDeviceCommandBatch,
  type StopDeviceCommandBatch,
} from '@discocan/device-contract';
import type {
  FleetDeviceCommandBatch,
  FleetDeviceCommandRequest,
} from '../../generated/graphql/types.js';
import { newestAnsweredFaultReads } from '../device-adapter.js';
import { requestDeviceServer } from './discocan-api.js';

function commandRequest(value: unknown): FleetDeviceCommandRequest {
  return { ...parseDeviceCommandRequest(value, parseDeviceCommand), deviceType: 'DISCOCAN' };
}

function commandBatch(value: unknown): FleetDeviceCommandBatch {
  return { ...parseDeviceCommandBatch(value, commandRequest), deviceType: 'DISCOCAN' };
}

function command<T>(path: string, body: object, parse: (value: unknown) => T) {
  return requestDeviceServer(path, {
    body,
    parse: (value) => parseDeviceCommandOutcome(value, parse),
  });
}

export const discocanCommands = {
  createCommand: (body: CreateDeviceCommandRequest) => {
    return command(DEVICE_SERVER_ROUTES.createCommand, body, commandRequest);
  },

  listCommands: (body: DeviceCommandRequestsQuery) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.listCommands, {
      body,
      parse: (value) => parseDeviceCommandRequestsPage(value, commandRequest),
    });
  },

  getCommand: (body: DeviceCommandRequestLookup) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.getCommand, {
      body,
      parse: (value) => parseDeviceCommandLookup(value, commandRequest),
    });
  },

  cancelCommand: (body: CancelDeviceCommandRequest) => {
    return command(DEVICE_SERVER_ROUTES.cancelCommand, body, commandRequest);
  },

  retryCommand: (body: RetryDeviceCommandRequest) => {
    return command(DEVICE_SERVER_ROUTES.retryCommand, body, commandRequest);
  },

  startCommandBatch: (body: StartDeviceCommandBatch) => {
    return command(DEVICE_SERVER_ROUTES.startCommandBatch, body, commandBatch);
  },

  getCommandBatch: (body: DeviceCommandBatchLookup) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.getCommandBatch, {
      body,
      parse: (value) => parseDeviceCommandLookup(value, commandBatch),
    });
  },

  stopCommandBatch: (body: StopDeviceCommandBatch) => {
    return command(DEVICE_SERVER_ROUTES.stopCommandBatch, body, commandBatch);
  },

  commandRequestHistory: (body: DeviceCommandRequestHistory) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.commandRequestHistory, {
      body,
      parse: (value) => parseDeviceCommandRequestHistoryResult(value, commandRequest),
    });
  },

  commandHistory: (body: DeviceCommandHistoryRequest) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.commandHistory, {
      body,
      parse: (value) => parseDeviceCommandsPage(value, parseDeviceCommand),
    });
  },

  actionCatalog: (body: DeviceCommandScope) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.actionCatalog, {
      body,
      parse: parseDeviceActionCatalog,
    });
  },

  requestFaultRead: async (body: DeviceFaultReadRequest) => {
    const outcome = await requestDeviceServer(DEVICE_SERVER_ROUTES.requestFaultRead, {
      body,
      parse: parseDeviceFaultReadOutcome,
    });
    return 'queued' in outcome && outcome.queued;
  },

  answeredFaultReads: async (
    body: DeviceAnsweredFaultReadsQuery,
  ): Promise<DeviceAnsweredFaultReads> => {
    const items: DeviceAnsweredFaultReads['items'] = [];
    let total = 0;
    for (let offset = 0; offset < body.deviceIds.length; offset += 100) {
      const page = await requestDeviceServer(DEVICE_SERVER_ROUTES.answeredFaultReads, {
        body: { ...body, deviceIds: body.deviceIds.slice(offset, offset + 100) },
        parse: parseDeviceAnsweredFaultReads,
      });
      total += page.total;
      items.push(...page.items);
    }
    return { total, items: newestAnsweredFaultReads(items, body.count) };
  },
};
