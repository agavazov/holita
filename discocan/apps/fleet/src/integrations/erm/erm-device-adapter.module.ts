import { Module } from '@nestjs/common';
import { ErmCommands } from './erm-commands.js';
import { ErmConfiguration } from './erm-configuration.js';
import { ErmStatus } from './erm-status.js';
import { ErmFaultReads } from './erm-fault-reads.js';
import { ErmDeviceAdapter } from './erm-device-adapter.js';
import { ErmInspection } from './erm-inspection.js';
import { ErmNotifications } from './erm-notifications.js';
import { ErmReports } from './erm-reports.js';

@Module({
  providers: [
    ErmDeviceAdapter,
    ErmCommands,
    ErmConfiguration,
    ErmStatus,
    ErmFaultReads,
    ErmInspection,
    ErmNotifications,
    ErmReports,
  ],
  exports: [ErmDeviceAdapter],
})
export class ErmDeviceAdapterModule {}
