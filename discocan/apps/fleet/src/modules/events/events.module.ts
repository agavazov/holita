import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { ErmDashboardClientModule } from '../../integrations/erm/erm-dashboard.module.js';
import { EventsRepository } from './events.repository.js';
import { EventsResolver } from './events.resolver.js';
import { EventsService } from './events.service.js';
import { ProblemsRepository } from './problems.repository.js';
import { ProblemsResolver } from './problems.resolver.js';
import { ProblemsService } from './problems.service.js';

@Module({
  imports: [DatabaseModule, ClockModule, ErmDashboardClientModule],
  exports: [EventsService, ProblemsService],
  providers: [
    FleetEnabledGuard,
    EventsRepository,
    EventsService,
    EventsResolver,
    ProblemsRepository,
    ProblemsService,
    ProblemsResolver,
  ],
})
export class EventsModule {}
