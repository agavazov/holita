import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesResolver } from './devices.resolver.js';
import { DevicesService } from './devices.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { InternalErmDeviceTargetController } from './internal-erm-device-target.controller.js';
import { InternalErmDeviceTargetGuard } from './internal-erm-device-target.guard.js';

@Module({
  imports: [DatabaseModule, CoreClientModule, ClockModule, TelemetryModule, SettingsModule],
  controllers: [InternalErmDeviceTargetController],
  providers: [
    FleetEnabledGuard,
    InternalErmDeviceTargetGuard,
    DevicesRepository,
    DevicesService,
    DevicesResolver,
  ],
  exports: [DevicesService],
})
export class DevicesModule {}
