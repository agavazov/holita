import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { DatabaseModule } from '../database/database.module.js';
import { TagsRepository } from './tags.repository.js';
import { TagsResolver } from './tags.resolver.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ReferenceEnabledGuard, CoreClient, TagsRepository, TagsService, TagsResolver],
})
export class TagsModule {}
