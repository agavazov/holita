import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EventsModule } from '../events/events.module.js';
import { ServiceTasksModule } from '../service-tasks/service-tasks.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { FaultCheckJobs } from './fault-check.jobs.js';
import { FaultCheckRepository } from './fault-check.repository.js';
import { VehiclesRepository } from './vehicles.repository.js';
import { VehiclesResolver } from './vehicles.resolver.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [
    DatabaseModule,
    ClockModule,
    CoreClientModule,
    TelemetryModule,
    EventsModule,
    ServiceTasksModule,
    DevicesModule,
  ],
  providers: [
    FleetEnabledGuard,
    VehiclesRepository,
    VehiclesService,
    VehiclesResolver,
    FaultCheckRepository,
    FaultCheckJobs,
  ],
})
export class VehiclesModule {}
