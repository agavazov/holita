import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { InternalSalesAgentsController } from './internal-sales-agents.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [InternalSalesAgentsController],
  providers: [UsersRepository, UsersService, UsersResolver],
})
export class UsersModule {}
