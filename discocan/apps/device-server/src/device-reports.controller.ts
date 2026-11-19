import { DEVICE_SERVER_ROUTES, parseDeviceReportsRequest } from '@discocan/device-contract';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from './device-token.guard.js';
import { parseRequest } from './parse-request.js';

@Controller()
@UseGuards(DeviceTokenGuard)
export class DeviceReportsController {
  @Get(DEVICE_SERVER_ROUTES.reports)
  reports(@Param('imei') imei: string, @Query() query: unknown) {
    const { after } = parseRequest(() => parseDeviceReportsRequest(imei, query));
    return { reports: [], next: after.toString() };
  }
}
