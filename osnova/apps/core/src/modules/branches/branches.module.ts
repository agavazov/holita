import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { BranchesRepository } from './branches.repository.js';
import { BranchesResolver } from './branches.resolver.js';
import { InternalBranchesController } from './internal-branches.controller.js';
import { BranchesService } from './branches.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalBranchesController],
  providers: [BranchesRepository, BranchesService, BranchesResolver],
})
export class BranchesModule {}
