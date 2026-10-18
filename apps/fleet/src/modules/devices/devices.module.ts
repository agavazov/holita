import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesResolver } from './devices.resolver.js';
import { DevicesService } from './devices.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, ClockModule, TelemetryModule],
  providers: [FleetEnabledGuard, DevicesRepository, DevicesService, DevicesResolver],
})
export class DevicesModule {}
