import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { TelemetryResolver } from './telemetry.resolver.js';
import { TelemetryService } from './telemetry.service.js';

@Module({
  imports: [DatabaseModule, DevicesModule],
  providers: [TelemetryRepository, TelemetryService, TelemetryResolver],
})
export class TelemetryModule {}
