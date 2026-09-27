import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { DatabaseModule } from '../database/database.module.js';
import { EventHistoryRepository } from './event-history.repository.js';
import { EventsRepository } from './events.repository.js';
import { EventsResolver } from './events.resolver.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [DatabaseModule],
  exports: [EventsRepository, EventHistoryRepository],
  providers: [
    EventHistoryRepository,
    ReferenceEnabledGuard,
    CoreClient,
    EventsRepository,
    EventsService,
    EventsResolver,
  ],
})
export class EventsModule {}
