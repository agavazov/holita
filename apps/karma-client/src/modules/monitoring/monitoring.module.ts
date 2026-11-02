import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { DeviceConfigurationGuard } from '../device-configuration/device-configuration.guard.js';
import { MonitoringController } from './monitoring.controller.js';
import { MonitoringService } from './monitoring.service.js';

@Module({
  imports: [KarmaTransportModule],
  providers: [DeviceConfigurationGuard, MonitoringService],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
