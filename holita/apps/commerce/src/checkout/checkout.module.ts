import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { DatabaseModule } from '../database.module.js';
import { CheckoutRepository } from './checkout.repository.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [DatabaseModule, CartModule],
  providers: [CheckoutRepository, CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
