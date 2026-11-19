import { Module } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DevicesModule } from '../../modules/devices/devices.module.js';
import { InternalErmDeviceTargetController } from './erm-device-target.controller.js';
import { InternalErmDeviceTargetGuard } from './erm-device-target.guard.js';

@Module({
  imports: [DevicesModule],
  controllers: [InternalErmDeviceTargetController],
  providers: [FleetEnabledGuard, InternalErmDeviceTargetGuard],
})
export class ErmIntegrationModule {}
