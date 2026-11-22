import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { ShopperRepository } from './shopper.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [ShopperRepository],
  exports: [ShopperRepository],
})
export class CustomersModule {}
