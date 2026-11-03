import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { validateCommand } from './command.js';
import { DevicesService } from './devices.service.js';
import { InternalDevicesGuard } from './internal-devices.guard.js';

@Controller('internal/units')
@UseGuards(InternalDevicesGuard)
export class InternalDevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  units() {
    return this.devices.listUnits();
  }

  @Post(':unitId/commands')
  @HttpCode(200)
  command(@Param('unitId') unitId: string, @Body() body: unknown) {
    return this.devices.sendCommand(unitId, validateCommand(body));
  }
}
