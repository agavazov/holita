import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CharacteristicsRepository } from './characteristics.repository.js';
import { CharacteristicsService } from './characteristics.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CharacteristicsRepository, CharacteristicsService],
  exports: [CharacteristicsRepository, CharacteristicsService],
})
export class CharacteristicsModule {}
