import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { StoresRepository } from './stores.repository.js';
import { StoresResolver } from './stores.resolver.js';
import { StoresService } from './stores.service.js';

@Module({ providers: [PrismaService, StoresRepository, StoresService, StoresResolver] })
export class StoresModule {}
