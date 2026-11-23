import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { DatabaseModule } from '../database.module.js';
import { ShopSettingsRepository } from './shop-settings.repository.js';
import { ShopSettingsService } from './shop-settings.service.js';

@Module({
  imports: [DatabaseModule, CategoriesModule],
  providers: [ShopSettingsRepository, ShopSettingsService],
  exports: [ShopSettingsService],
})
export class ShopSettingsModule {}
