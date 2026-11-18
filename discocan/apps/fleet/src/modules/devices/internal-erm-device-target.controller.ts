import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DevicesService } from './devices.service.js';
import { InternalErmDeviceTargetGuard } from './internal-erm-device-target.guard.js';

@Controller('internal/erm-device-target')
@UseGuards(FleetEnabledGuard, InternalErmDeviceTargetGuard)
export class InternalErmDeviceTargetController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(200)
  target(@Body() body: unknown) {
    return this.devices.internalErmDeviceTarget(body);
  }
}
