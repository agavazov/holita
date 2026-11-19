import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ClockModule } from '../../clock/clock.module.js';
import { DeviceAdaptersModule } from '../../integrations/device-adapters.module.js';
import { DeviceTelemetryJobs } from './device-telemetry.jobs.js';
import { DeviceTelemetryRepository } from './device-telemetry.repository.js';

@Module({
  imports: [DatabaseModule, ClockModule, DeviceAdaptersModule],
  providers: [DeviceTelemetryJobs, DeviceTelemetryRepository],
})
export class DeviceTelemetryModule {}
