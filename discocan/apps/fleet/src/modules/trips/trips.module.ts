import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { EventsModule } from '../events/events.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { TripsRepository } from './trips.repository.js';
import { TripsResolver } from './trips.resolver.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [DatabaseModule, TelemetryModule, EventsModule],
  exports: [TripsService],
  providers: [FleetEnabledGuard, TripsRepository, TripsService, TripsResolver],
})
export class TripsModule {}
