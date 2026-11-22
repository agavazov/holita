import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CartRepository, CartService],
  exports: [CartRepository, CartService],
})
export class CartModule {}
