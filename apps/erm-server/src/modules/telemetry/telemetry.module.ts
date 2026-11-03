import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { TelemetryResolver } from './telemetry.resolver.js';
import { TelemetryService } from './telemetry.service.js';
import { ermRole } from '../../role.js';
import { LiveDevicesService } from './live-devices.service.js';
import { FleetClient } from './fleet.client.js';
import { ErmDeviceResolver, ErmEventResolver } from './telemetry.resolver.js';
import { InternalTelemetryController } from './internal-telemetry.controller.js';
import { InternalTelemetryGuard } from './internal-telemetry.guard.js';

@Module({
  imports: [DatabaseModule, ...(ermRole() === 'api' ? [] : [DevicesModule])],
  controllers: [InternalTelemetryController],
  providers: [
    TelemetryRepository,
    TelemetryService,
    TelemetryResolver,
    ErmDeviceResolver,
    ErmEventResolver,
    LiveDevicesService,
    FleetClient,
    InternalTelemetryGuard,
  ],
})
export class TelemetryModule {}
