import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DriversRepository } from './drivers.repository.js';
import { DriversResolver } from './drivers.resolver.js';
import { DriversService } from './drivers.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, ClockModule],
  exports: [DriversService],
  providers: [FleetEnabledGuard, DriversRepository, DriversService, DriversResolver],
})
export class DriversModule {}
