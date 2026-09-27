import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { DatabaseModule } from '../database/database.module.js';
import { VenuesRepository } from './venues.repository.js';
import { VenuesResolver } from './venues.resolver.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ReferenceEnabledGuard, CoreClient, VenuesRepository, VenuesService, VenuesResolver],
})
export class VenuesModule {}
