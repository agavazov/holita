import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { DeviceConfigurationGuard } from '../device-configuration/device-configuration.guard.js';
import { MonitoringService } from './monitoring.service.js';

@Controller('internal/karma-monitoring')
@UseGuards(DeviceConfigurationGuard)
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post('status')
  @HttpCode(200)
  status() {
    return this.monitoring.status();
  }

  @Post('history')
  @HttpCode(200)
  history(@Body() body: unknown) {
    return this.monitoring.history(body);
  }

  @Post('recovery')
  @HttpCode(200)
  recovery(@Body() body: unknown) {
    return this.monitoring.recovery(body);
  }
}
