import {
  DEVICE_SERVER_ROUTES,
  parseDeviceNotificationsRequest,
  type DeviceNotificationPage,
} from '@discocan/device-contract';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceNotificationsController {
  @Get(DEVICE_SERVER_ROUTES.notifications)
  notifications(@Param('imei') imei: string, @Query() query: unknown): DeviceNotificationPage {
    const { after } = parseRequest(() => parseDeviceNotificationsRequest(imei, query));
    return { items: [], next: after ?? '0', hasMore: false };
  }
}
