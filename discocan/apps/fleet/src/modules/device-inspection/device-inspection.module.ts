import { Module } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DeviceAdaptersModule } from '../../integrations/device-adapters.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DeviceInspectionResolver, DeviceEventResolver } from './device-inspection.resolver.js';
import { DeviceInspectionService } from './device-inspection.service.js';

@Module({
  imports: [DevicesModule, DeviceAdaptersModule],
  providers: [
    FleetEnabledGuard,
    DeviceInspectionResolver,
    DeviceInspectionService,
    DeviceEventResolver,
  ],
})
export class DeviceInspectionModule {}
