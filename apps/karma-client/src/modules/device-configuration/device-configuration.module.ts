import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { DeviceConfigurationController } from './device-configuration.controller.js';
import { DeviceConfigurationGuard } from './device-configuration.guard.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

@Module({
  imports: [KarmaTransportModule],
  providers: [DeviceConfigurationGuard, DeviceConfigurationService],
  controllers: [DeviceConfigurationController],
})
export class DeviceConfigurationModule {}
