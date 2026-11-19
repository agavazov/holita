import { Module } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DeviceAdaptersModule } from '../../integrations/device-adapters.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DeviceConfigurationResolver } from './device-configuration.resolver.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

@Module({
  imports: [DevicesModule, DeviceAdaptersModule],
  providers: [FleetEnabledGuard, DeviceConfigurationResolver, DeviceConfigurationService],
})
export class DeviceConfigurationModule {}
