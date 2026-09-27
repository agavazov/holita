import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { EventsModule } from '../events/events.module.js';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsResolver } from './sessions.resolver.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [DatabaseModule, EventsModule],
  providers: [ReferenceEnabledGuard, SessionsRepository, SessionsService, SessionsResolver],
})
export class SessionsModule {}
