import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { BranchesRepository } from './branches.repository.js';
import { BranchesResolver } from './branches.resolver.js';
import { BranchesService } from './branches.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [BranchesRepository, BranchesService, BranchesResolver],
})
export class BranchesModule {}
