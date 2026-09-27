import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { DatabaseModule } from '../database/database.module.js';
import { SpeakersRepository } from './speakers.repository.js';
import { SpeakersResolver } from './speakers.resolver.js';
import { SpeakersService } from './speakers.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    ReferenceEnabledGuard,
    CoreClient,
    SpeakersRepository,
    SpeakersService,
    SpeakersResolver,
  ],
})
export class SpeakersModule {}
