import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { EventsRepository } from './events.repository.js';
import { EventsResolver } from './events.resolver.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [DatabaseModule, ClockModule],
  exports: [EventsService],
  providers: [FleetEnabledGuard, EventsRepository, EventsService, EventsResolver],
})
export class EventsModule {}
