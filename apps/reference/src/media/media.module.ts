import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { EventsModule } from '../events/events.module.js';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { MediaStorage } from './media-storage.js';
import { LocalMediaStorage } from './local-media-storage.js';
import { MediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';
import { MediaResolver } from './media.resolver.js';
import { MediaController } from './media.controller.js';
import { MediaCleanup } from './media.cleanup.js';

@Module({
  imports: [DatabaseModule, EventsModule],
  providers: [
    ReferenceEnabledGuard,
    LocalMediaStorage,
    { provide: MediaStorage, useExisting: LocalMediaStorage },
    MediaRepository,
    MediaService,
    MediaResolver,
    MediaCleanup,
  ],
  controllers: [MediaController],
})
export class MediaModule {}
