import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { ShopSettingsRepository } from './shop-settings.repository.js';
import { ShopSettingsService } from './shop-settings.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ShopSettingsRepository, ShopSettingsService],
  exports: [ShopSettingsService],
})
export class ShopSettingsModule {}
