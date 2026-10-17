import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { BranchesRepository } from './branches.repository.js';
import { BranchesResolver } from './branches.resolver.js';
import { BranchesService } from './branches.service.js';

@Module({ providers: [PrismaService, BranchesRepository, BranchesService, BranchesResolver] })
export class BranchesModule {}
