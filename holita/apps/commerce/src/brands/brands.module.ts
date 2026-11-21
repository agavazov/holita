import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { BrandImages } from './brand-images.js';
import { BrandsRepository } from './brands.repository.js';
import { BrandsService } from './brands.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [BrandsRepository, BrandsService, BrandImages],
  exports: [BrandsRepository, BrandsService, BrandImages],
})
export class BrandsModule {}
