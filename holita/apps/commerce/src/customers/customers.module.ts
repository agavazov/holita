import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CustomersService } from './customers.service.js';
import { ShopperRepository } from './shopper.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [ShopperRepository, CustomersService],
  exports: [ShopperRepository, CustomersService],
})
export class CustomersModule {}
