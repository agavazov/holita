import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CategoriesRepository, CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
