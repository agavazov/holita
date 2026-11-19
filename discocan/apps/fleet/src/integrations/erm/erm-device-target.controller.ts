import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DevicesRepository } from '../../modules/devices/devices.repository.js';
import { uuid } from '../../validation.js';
import { InternalErmDeviceTargetGuard } from './erm-device-target.guard.js';

@Controller('internal/erm-device-target')
@UseGuards(FleetEnabledGuard, InternalErmDeviceTargetGuard)
export class InternalErmDeviceTargetController {
  constructor(private readonly devices: DevicesRepository) {}

  @Post()
  @HttpCode(200)
  async target(@Body() body: unknown): Promise<{ matches: boolean }> {
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 4 ||
      !('tenantId' in body) ||
      !('branchId' in body) ||
      !('deviceId' in body) ||
      !('imei' in body)
    ) {
      throw new BadRequestException('Use tenantId, branchId, deviceId and imei.');
    }
    const scope = {
      tenantId: uuid(body.tenantId, 'tenantId'),
      branchId: uuid(body.branchId, 'branchId'),
    };
    const deviceId = uuid(body.deviceId, 'deviceId');
    if (typeof body.imei !== 'string' || !/^\d{15}$/.test(body.imei)) {
      throw new BadRequestException('Use an IMEI of exactly 15 digits.');
    }
    const device = await this.devices.find(scope, deviceId);
    return { matches: device?.imei === body.imei };
  }
}
