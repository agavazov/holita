import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { OffersRepository } from './offers.repository.js';
import { OffersResolver } from './offers.resolver.js';
import { OffersService } from './offers.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [OffersRepository, OffersService, OffersResolver],
})
export class OffersModule {}
