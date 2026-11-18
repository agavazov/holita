import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersRepository } from './users.repository.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [UsersRepository, UsersService, UsersResolver],
})
export class UsersModule {}
