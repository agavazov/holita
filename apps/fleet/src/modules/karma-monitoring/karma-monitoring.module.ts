import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { KarmaDeviceReadsModule } from '../../integrations/karma/karma-device-reads.module.js';
import { DeviceOperationsModule } from '../device-operations/device-operations.module.js';
import { KarmaMonitoringJobs } from './karma-monitoring.jobs.js';
import { KarmaMonitoringRepository } from './karma-monitoring.repository.js';
import { KarmaMonitoringResolver } from './karma-monitoring.resolver.js';
import { KarmaMonitoringService } from './karma-monitoring.service.js';
import { KarmaMonitoringSourceService } from './karma-monitoring-source.service.js';

@Module({
  imports: [
    DatabaseModule,
    ClockModule,
    CoreClientModule,
    KarmaDeviceReadsModule,
    DeviceOperationsModule,
  ],
  providers: [
    FleetEnabledGuard,
    KarmaMonitoringRepository,
    KarmaMonitoringService,
    KarmaMonitoringResolver,
    KarmaMonitoringJobs,
    KarmaMonitoringSourceService,
  ],
})
export class KarmaMonitoringModule {}
