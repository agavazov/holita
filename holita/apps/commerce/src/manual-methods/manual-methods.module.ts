import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { ManualMethodsRepository } from './manual-methods.repository.js';
import { ManualMethodsService } from './manual-methods.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ManualMethodsRepository, ManualMethodsService],
  exports: [ManualMethodsRepository, ManualMethodsService],
})
export class ManualMethodsModule {}
