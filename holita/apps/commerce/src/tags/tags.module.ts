import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { TagsRepository } from './tags.repository.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [TagsRepository, TagsService],
  exports: [TagsService],
})
export class TagsModule {}
