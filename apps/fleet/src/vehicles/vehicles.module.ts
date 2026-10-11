import { FleetEnabledGuard } from '../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { DatabaseModule } from '../database/database.module.js';
import { VehiclesRepository } from './vehicles.repository.js';
import { VehiclesResolver } from './vehicles.resolver.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [DatabaseModule],
  exports: [VehiclesService],
  providers: [FleetEnabledGuard, CoreClient, VehiclesRepository, VehiclesService, VehiclesResolver],
})
export class VehiclesModule {}
