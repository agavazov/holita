import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ClockModule } from '../../clock/clock.module.js';
import { ErmTelemetryClientModule } from '../../integrations/erm/erm-telemetry.module.js';
import { ErmTelemetryJobs } from './erm-telemetry.jobs.js';
import { ErmTelemetryRepository } from './erm-telemetry.repository.js';

@Module({
  imports: [DatabaseModule, ClockModule, ErmTelemetryClientModule],
  providers: [ErmTelemetryJobs, ErmTelemetryRepository],
})
export class ErmTelemetryModule {}
