import { Module } from '@nestjs/common';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceService } from './commerce.service.js';
import { ProductImages } from './product-images.js';
import { DatabaseModule } from '../database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [CommerceRepository, CommerceService, ProductImages],
  exports: [CommerceRepository, CommerceService, ProductImages],
})
export class ProductsModule {}
