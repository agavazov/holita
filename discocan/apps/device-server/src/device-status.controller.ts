import {
  DEVICE_SERVER_ROUTES,
  parseDeviceLiveRequest,
  parseDeviceProblemRequest,
  type DeviceLiveSnapshot,
  type DeviceProblemPage,
} from '@discocan/device-contract';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceStatusController {
  @Post(DEVICE_SERVER_ROUTES.live)
  @HttpCode(200)
  live(@Body() body: unknown): DeviceLiveSnapshot {
    parseRequest(() => parseDeviceLiveRequest(body));
    return { asOf: new Date(), devices: [] };
  }

  @Post(DEVICE_SERVER_ROUTES.problems)
  @HttpCode(200)
  problems(@Body() body: unknown): DeviceProblemPage {
    parseRequest(() => parseDeviceProblemRequest(body));
    return { asOf: new Date(), items: [], counts: [], totalCount: 0, hasMore: false };
  }
}
