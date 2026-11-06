import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ClockModule } from '../../clock/clock.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { OverviewRepository } from './overview.repository.js';
import { OverviewResolver } from './overview.resolver.js';
import { OverviewService } from './overview.service.js';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { EventsModule } from '../events/events.module.js';
import { ErmDashboardClientModule } from '../../integrations/erm/erm-dashboard.module.js';

@Module({
  imports: [DatabaseModule, ClockModule, EventsModule, ErmDashboardClientModule],
  providers: [
    FleetEnabledGuard,
    OverviewRepository,
    OverviewService,
    OverviewResolver,
    DashboardRepository,
    DashboardService,
  ],
})
export class OverviewModule {}
