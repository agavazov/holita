import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EventsModule } from '../events/events.module.js';
import { ServiceTasksModule } from '../service-tasks/service-tasks.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { VehiclesRepository } from './vehicles.repository.js';
import { VehiclesResolver } from './vehicles.resolver.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, TelemetryModule, EventsModule, ServiceTasksModule],
  providers: [FleetEnabledGuard, VehiclesRepository, VehiclesService, VehiclesResolver],
})
export class VehiclesModule {}
