import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { LeadsRepository } from './leads.repository.js';
import { LeadsResolver } from './leads.resolver.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [LeadsRepository, LeadsResolver, LeadsService],
})
export class LeadsModule {}
