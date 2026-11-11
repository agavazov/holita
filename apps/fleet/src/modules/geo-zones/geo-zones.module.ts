import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { GeoZonesJobs } from './geo-zones.jobs.js';
import { GeoZonesRepository } from './geo-zones.repository.js';
import { GeoZonesResolver } from './geo-zones.resolver.js';
import { GeoZonesService } from './geo-zones.service.js';

@Module({
  imports: [DatabaseModule, ClockModule, CoreClientModule],
  providers: [
    FleetEnabledGuard,
    GeoZonesRepository,
    GeoZonesService,
    GeoZonesResolver,
    GeoZonesJobs,
  ],
})
export class GeoZonesModule {}
