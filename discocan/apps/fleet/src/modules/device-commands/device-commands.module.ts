import { Module } from '@nestjs/common';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DeviceAdaptersModule } from '../../integrations/device-adapters.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DeviceCommandsResolver } from './device-commands.resolver.js';
import { DeviceCommandsService } from './device-commands.service.js';
import { FaultReadLog } from './fault-read-log.js';
import { FaultReadJobs } from './fault-read.jobs.js';

@Module({
  imports: [DevicesModule, DeviceAdaptersModule],
  providers: [
    FleetEnabledGuard,
    DeviceCommandsResolver,
    DeviceCommandsService,
    FaultReadJobs,
    FaultReadLog,
  ],
  exports: [FaultReadLog],
})
export class DeviceCommandsModule {}
