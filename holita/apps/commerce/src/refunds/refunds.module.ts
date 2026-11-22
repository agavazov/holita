import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { RefundsRepository } from './refunds.repository.js';
import { RefundsService } from './refunds.service.js';

@Module({
  imports: [DatabaseModule, OrdersModule],
  providers: [RefundsRepository, RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
