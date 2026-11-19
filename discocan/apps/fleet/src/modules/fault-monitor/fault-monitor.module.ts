import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { DeviceCommandsModule } from '../device-commands/device-commands.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { FaultMonitorRepository } from './fault-monitor.repository.js';
import { FaultMonitorResolver } from './fault-monitor.resolver.js';
import { FaultMonitorService } from './fault-monitor.service.js';

@Module({
  imports: [DatabaseModule, ClockModule, DeviceCommandsModule, DevicesModule, VehiclesModule],
  providers: [FleetEnabledGuard, FaultMonitorRepository, FaultMonitorService, FaultMonitorResolver],
})
export class FaultMonitorModule {}
