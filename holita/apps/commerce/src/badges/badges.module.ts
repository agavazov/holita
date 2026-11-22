import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { BadgesRepository } from './badges.repository.js';
import { BadgesService } from './badges.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [BadgesRepository, BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
