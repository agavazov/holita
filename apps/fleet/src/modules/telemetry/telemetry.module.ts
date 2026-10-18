import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { TelemetryResolver } from './telemetry.resolver.js';
import { TelemetryService } from './telemetry.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, ClockModule],
  exports: [TelemetryService],
  providers: [FleetEnabledGuard, TelemetryRepository, TelemetryService, TelemetryResolver],
})
export class TelemetryModule {}
