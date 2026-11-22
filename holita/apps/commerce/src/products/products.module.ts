import { Module } from '@nestjs/common';
import { CommerceRepository } from '../commerce.repository.js';
import { CommerceService } from '../commerce.service.js';
import { DatabaseModule } from '../database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [CommerceRepository, CommerceService],
  exports: [CommerceRepository, CommerceService],
})
export class ProductsModule {}
