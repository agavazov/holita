import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CoreMerchantProvisioning } from './core-merchant-provisioning.js';
import { CoreSalesAgents } from './core-sales-agents.js';
import { LeadNotesRepository } from './lead-notes.repository.js';
import { LeadNotesResolver } from './lead-notes.resolver.js';
import { LeadNotesService } from './lead-notes.service.js';
import { LeadTasksRepository } from './lead-tasks.repository.js';
import { LeadTasksResolver } from './lead-tasks.resolver.js';
import { LeadTasksService } from './lead-tasks.service.js';
import { LeadsRepository } from './leads.repository.js';
import { LeadsResolver } from './leads.resolver.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    CoreMerchantProvisioning,
    CoreSalesAgents,
    LeadsRepository,
    LeadsResolver,
    LeadsService,
    LeadNotesRepository,
    LeadNotesResolver,
    LeadNotesService,
    LeadTasksRepository,
    LeadTasksResolver,
    LeadTasksService,
  ],
})
export class LeadsModule {}
