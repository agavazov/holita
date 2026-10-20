import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsResolver } from './settings.resolver.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [DatabaseModule, CoreClientModule],
  providers: [FleetEnabledGuard, SettingsRepository, SettingsService, SettingsResolver],
  exports: [SettingsService],
})
export class SettingsModule {}
