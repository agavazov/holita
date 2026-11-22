import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { DiscountsRepository } from './discounts.repository.js';
import { DiscountsService } from './discounts.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [DiscountsRepository, DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
