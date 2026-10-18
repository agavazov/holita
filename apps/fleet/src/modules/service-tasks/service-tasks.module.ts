import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { ServiceTasksRepository } from './service-tasks.repository.js';
import { ServiceTasksResolver } from './service-tasks.resolver.js';
import { ServiceTasksService } from './service-tasks.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, ClockModule],
  exports: [ServiceTasksService],
  providers: [FleetEnabledGuard, ServiceTasksRepository, ServiceTasksService, ServiceTasksResolver],
})
export class ServiceTasksModule {}
