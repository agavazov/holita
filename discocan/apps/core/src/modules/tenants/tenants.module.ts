import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { TenantsRepository } from './tenants.repository.js';
import { TenantsService } from './tenants.service.js';
import { TenantsResolver } from './tenants.resolver.js';

@Module({
  imports: [DatabaseModule],
  providers: [TenantsRepository, TenantsService, TenantsResolver],
})
export class TenantsModule {}
