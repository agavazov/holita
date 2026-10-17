import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { VehiclesRepository } from './vehicles.repository.js';
import { VehiclesResolver } from './vehicles.resolver.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule],
  exports: [VehiclesService],
  providers: [FleetEnabledGuard, VehiclesRepository, VehiclesService, VehiclesResolver],
})
export class VehiclesModule {}
