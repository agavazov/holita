import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { ProductsModule } from '../products/products.module.js';
import { CatalogueImportsRepository } from './catalogue-imports.repository.js';
import { CatalogueImportsService } from './catalogue-imports.service.js';

@Module({
  imports: [DatabaseModule, ProductsModule],
  providers: [CatalogueImportsRepository, CatalogueImportsService],
  exports: [CatalogueImportsService],
})
export class CatalogueImportsModule {}
