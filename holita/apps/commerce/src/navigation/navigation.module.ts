import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { DatabaseModule } from '../database.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { NavigationRepository } from './navigation.repository.js';
import { NavigationService } from './navigation.service.js';

@Module({
  imports: [DatabaseModule, CategoriesModule, PagesModule],
  providers: [NavigationRepository, NavigationService],
  exports: [NavigationService],
})
export class NavigationModule {}
