import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { Module } from '@nestjs/common';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesResolver } from './devices.resolver.js';
import { DevicesService } from './devices.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, VehiclesModule],
  providers: [FleetEnabledGuard, DevicesRepository, DevicesService, DevicesResolver],
})
export class DevicesModule {}
