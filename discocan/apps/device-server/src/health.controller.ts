import { DEVICE_SERVER_ROUTES, type DeviceHealth } from '@discocan/device-contract';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get(DEVICE_SERVER_ROUTES.health)
  health(): DeviceHealth {
    return { status: 'ok', service: 'device-server' };
  }
}
