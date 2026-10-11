import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { TenantsRepository } from './tenants.repository.js';
import { TenantsService } from './tenants.service.js';
import { TenantsResolver } from './tenants.resolver.js';

@Module({ providers: [PrismaService, TenantsRepository, TenantsService, TenantsResolver] })
export class TenantsModule {}
