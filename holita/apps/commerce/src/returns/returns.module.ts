import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ReturnsRepository } from './returns.repository.js';
import { ReturnsService } from './returns.service.js';

@Module({
  imports: [DatabaseModule, OrdersModule],
  providers: [ReturnsRepository, ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
