import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { EdataChangeRepository } from '../telemetry/edata-change.repository.js';
import { validateCommand } from './command.js';
import { DevicesService } from './devices.service.js';
import { InternalDevicesGuard } from './internal-devices.guard.js';

@Controller('internal/units')
@UseGuards(InternalDevicesGuard)
export class InternalDevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  units() {
    return this.devices.listUnits();
  }

  @Post(':unitId/configuration-changes/:changeId/globals')
  @HttpCode(200)
  async globals(@Param('unitId') unitId: string, @Param('changeId') changeId: string) {
    const command = await new EdataChangeRepository(this.prisma.client).globalsCommand(
      changeId,
      unitId,
    );
    return this.devices.sendRecordedGlobals(unitId, command);
  }

  @Post(':unitId/commands')
  @HttpCode(200)
  command(@Param('unitId') unitId: string, @Body() body: unknown) {
    return this.devices.sendCommand(unitId, validateCommand(body));
  }
}
