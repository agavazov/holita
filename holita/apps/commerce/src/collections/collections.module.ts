import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CollectionsRepository } from './collections.repository.js';
import { CollectionsService } from './collections.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CollectionsRepository, CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
