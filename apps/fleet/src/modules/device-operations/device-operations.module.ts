import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { KarmaDeviceReadsModule } from '../../integrations/karma/karma-device-reads.module.js';
import { DeviceOperationsProcessor } from './device-operations.processor.js';
import { DeviceOperationsRepository } from './device-operations.repository.js';
import { DeviceOperationsResolver } from './device-operations.resolver.js';
import { DeviceOperationsService } from './device-operations.service.js';
import { DeviceRuleOperationsProcessor } from './device-rule-operations.processor.js';

@Module({
  imports: [DatabaseModule, ClockModule, CoreClientModule, KarmaDeviceReadsModule],
  providers: [
    FleetEnabledGuard,
    DeviceOperationsRepository,
    DeviceOperationsService,
    DeviceOperationsProcessor,
    DeviceRuleOperationsProcessor,
    DeviceOperationsResolver,
  ],
})
export class DeviceOperationsModule {}
