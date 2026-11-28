import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { LocalMailboxModule } from '../local-mailbox/local-mailbox.module.js';
import { CustomersService } from './customers.service.js';
import { ShopperPasswordResetService } from './shopper-password-reset.service.js';
import { ShopperRepository } from './shopper.repository.js';

@Module({
  imports: [DatabaseModule, LocalMailboxModule],
  providers: [ShopperRepository, CustomersService, ShopperPasswordResetService],
  exports: [ShopperRepository, CustomersService, ShopperPasswordResetService],
})
export class CustomersModule {}
