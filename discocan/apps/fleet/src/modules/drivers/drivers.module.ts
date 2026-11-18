import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { EventsModule } from '../events/events.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { TripsModule } from '../trips/trips.module.js';
import { DriversRepository } from './drivers.repository.js';
import { DriversResolver } from './drivers.resolver.js';
import { DriversService } from './drivers.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [
    DatabaseModule,
    CoreClientModule,
    ClockModule,
    TelemetryModule,
    TripsModule,
    EventsModule,
    SettingsModule,
  ],
  exports: [DriversService],
  providers: [FleetEnabledGuard, DriversRepository, DriversService, DriversResolver],
})
export class DriversModule {}
