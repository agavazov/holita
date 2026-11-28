import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { LocalMailboxModule } from '../local-mailbox/local-mailbox.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { ReturnsRepository } from './returns.repository.js';
import { ReturnsService } from './returns.service.js';

@Module({
  imports: [DatabaseModule, LocalMailboxModule, OrdersModule, RefundsModule],
  providers: [ReturnsRepository, ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
