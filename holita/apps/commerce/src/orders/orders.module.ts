import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { DatabaseModule } from '../database.module.js';
import { DiscountsModule } from '../discounts/discounts.module.js';
import { LocalMailboxModule } from '../local-mailbox/local-mailbox.module.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    DatabaseModule,
    CartModule,
    CheckoutModule,
    CustomersModule,
    DiscountsModule,
    LocalMailboxModule,
  ],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
