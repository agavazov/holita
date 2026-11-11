import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CatalogSearchRepository } from './catalog-search.repository.js';
import { CatalogSearchResolver } from './catalog-search.resolver.js';
import { CatalogSearchService } from './catalog-search.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    FleetEnabledGuard,
    CatalogSearchRepository,
    CatalogSearchService,
    CatalogSearchResolver,
  ],
})
export class EdataCatalogModule {}
