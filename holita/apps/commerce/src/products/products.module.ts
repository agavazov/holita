import { Module } from '@nestjs/common';
import { CatalogueRepository } from './catalogue.repository.js';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceService } from './commerce.service.js';
import { ProductImages } from './product-images.js';
import { CharacteristicsModule } from '../characteristics/characteristics.module.js';
import { DatabaseModule } from '../database.module.js';

@Module({
  imports: [DatabaseModule, CharacteristicsModule],
  providers: [CatalogueRepository, CommerceRepository, CommerceService, ProductImages],
  exports: [CatalogueRepository, CommerceRepository, CommerceService, ProductImages],
})
export class ProductsModule {}
