import {
  DEVICE_SERVER_ROUTES,
  emptyDevicePage,
  parseDeviceEventsRequest,
  parseDeviceMessagesRequest,
  parseDeviceStateRequest,
  type DeviceEventPage,
  type DeviceMessagePage,
  type DeviceStateSnapshot,
} from '@discocan/device-contract';
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceInspectionController {
  @Post(DEVICE_SERVER_ROUTES.state)
  @HttpCode(200)
  state(@Body() body: unknown): DeviceStateSnapshot {
    parseRequest(() => parseDeviceStateRequest(body));
    return { asOf: new Date(), devices: [] };
  }

  @Get(DEVICE_SERVER_ROUTES.events)
  events(@Param('imei') imei: string, @Query() query: unknown): DeviceEventPage {
    return emptyDevicePage(parseRequest(() => parseDeviceEventsRequest(imei, query)));
  }

  @Get(DEVICE_SERVER_ROUTES.messages)
  messages(@Param('imei') imei: string, @Query() query: unknown): DeviceMessagePage {
    return emptyDevicePage(parseRequest(() => parseDeviceMessagesRequest(imei, query)));
  }
}
