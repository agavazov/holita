import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { InvoicesRepository } from './invoices.repository.js';
import { InvoicesService } from './invoices.service.js';

@Module({
  imports: [DatabaseModule, OrdersModule],
  providers: [InvoicesRepository, InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
