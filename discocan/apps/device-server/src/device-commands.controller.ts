import {
  DEVICE_SERVER_ROUTES,
  DEVICE_COMMANDS_UNSUPPORTED,
  parseCancelDeviceCommandRequest,
  parseCreateDeviceCommandRequest,
  parseDeviceActionCatalogRequest,
  parseDeviceAnsweredFaultReadsQuery,
  parseDeviceCommandBatchLookup,
  parseDeviceCommandHistoryRequest,
  parseDeviceCommandRequestHistory,
  parseDeviceCommandRequestLookup,
  parseDeviceCommandRequestsQuery,
  parseDeviceFaultReadRequest,
  parseRetryDeviceCommandRequest,
  parseStartDeviceCommandBatch,
  parseStopDeviceCommandBatch,
} from '@discocan/device-contract';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceCommandsController {
  @Post(DEVICE_SERVER_ROUTES.createCommand)
  @HttpCode(200)
  createCommand(@Body() body: unknown) {
    parseRequest(() => parseCreateDeviceCommandRequest(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.listCommands)
  @HttpCode(200)
  listCommands(@Body() body: unknown) {
    const { offset, limit } = parseRequest(() => parseDeviceCommandRequestsQuery(body));
    return { items: [], total: 0, offset, limit };
  }

  @Post(DEVICE_SERVER_ROUTES.getCommand)
  @HttpCode(200)
  getCommand(@Body() body: unknown) {
    parseRequest(() => parseDeviceCommandRequestLookup(body));
    return { item: null };
  }

  @Post(DEVICE_SERVER_ROUTES.cancelCommand)
  @HttpCode(200)
  cancelCommand(@Body() body: unknown) {
    parseRequest(() => parseCancelDeviceCommandRequest(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.retryCommand)
  @HttpCode(200)
  retryCommand(@Body() body: unknown) {
    parseRequest(() => parseRetryDeviceCommandRequest(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.startCommandBatch)
  @HttpCode(200)
  startCommandBatch(@Body() body: unknown) {
    parseRequest(() => parseStartDeviceCommandBatch(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.getCommandBatch)
  @HttpCode(200)
  getCommandBatch(@Body() body: unknown) {
    parseRequest(() => parseDeviceCommandBatchLookup(body));
    return { item: null };
  }

  @Post(DEVICE_SERVER_ROUTES.stopCommandBatch)
  @HttpCode(200)
  stopCommandBatch(@Body() body: unknown) {
    parseRequest(() => parseStopDeviceCommandBatch(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.commandRequestHistory)
  @HttpCode(200)
  commandRequestHistory(@Body() body: unknown) {
    parseRequest(() => parseDeviceCommandRequestHistory(body));
    return [];
  }

  @Post(DEVICE_SERVER_ROUTES.commandHistory)
  @HttpCode(200)
  commandHistory(@Body() body: unknown) {
    const { cursor } = parseRequest(() => parseDeviceCommandHistoryRequest(body));
    return { items: [], cursor, nextCursor: null, hasMore: false };
  }

  @Post(DEVICE_SERVER_ROUTES.actionCatalog)
  @HttpCode(200)
  actionCatalog(@Body() body: unknown) {
    parseRequest(() => parseDeviceActionCatalogRequest(body));
    return [];
  }

  @Post(DEVICE_SERVER_ROUTES.requestFaultRead)
  @HttpCode(200)
  requestFaultRead(@Body() body: unknown) {
    parseRequest(() => parseDeviceFaultReadRequest(body));
    return DEVICE_COMMANDS_UNSUPPORTED;
  }

  @Post(DEVICE_SERVER_ROUTES.answeredFaultReads)
  @HttpCode(200)
  answeredFaultReads(@Body() body: unknown) {
    parseRequest(() => parseDeviceAnsweredFaultReadsQuery(body));
    return { items: [], total: 0 };
  }
}
