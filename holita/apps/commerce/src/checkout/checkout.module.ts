import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { ManualMethodsModule } from '../manual-methods/manual-methods.module.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [CartModule, ManualMethodsModule],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
