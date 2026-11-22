import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { OptionsRepository } from './options.repository.js';
import { OptionsService } from './options.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [OptionsRepository, OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
