import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { VehicleGroupsRepository } from './vehicle-groups.repository.js';
import { VehicleGroupsResolver } from './vehicle-groups.resolver.js';
import { VehicleGroupsService } from './vehicle-groups.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule],
  providers: [
    FleetEnabledGuard,
    VehicleGroupsRepository,
    VehicleGroupsService,
    VehicleGroupsResolver,
  ],
})
export class VehicleGroupsModule {}
