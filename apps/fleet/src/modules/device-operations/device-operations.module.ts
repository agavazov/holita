import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { KarmaDeviceReadsModule } from '../../integrations/karma/karma-device-reads.module.js';
import { DeviceOperationsProcessor } from './device-operations.processor.js';
import { DeviceOperationsRepository } from './device-operations.repository.js';
import { DeviceOperationsResolver } from './device-operations.resolver.js';
import { DeviceOperationsService } from './device-operations.service.js';

@Module({
  imports: [DatabaseModule, ClockModule, KarmaDeviceReadsModule],
  providers: [
    FleetEnabledGuard,
    DeviceOperationsRepository,
    DeviceOperationsService,
    DeviceOperationsProcessor,
    DeviceOperationsResolver,
  ],
})
export class DeviceOperationsModule {}
