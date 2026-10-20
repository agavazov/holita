import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ClockModule } from '../../clock/clock.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { OverviewRepository } from './overview.repository.js';
import { OverviewResolver } from './overview.resolver.js';
import { OverviewService } from './overview.service.js';

@Module({
  imports: [DatabaseModule, ClockModule],
  providers: [FleetEnabledGuard, OverviewRepository, OverviewService, OverviewResolver],
})
export class OverviewModule {}
