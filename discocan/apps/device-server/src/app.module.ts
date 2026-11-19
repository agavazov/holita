import { Module } from '@nestjs/common';
import { DeviceReportsController } from './device-reports.controller.js';
import { DeviceStatusController } from './device-status.controller.js';
import { DeviceInspectionController } from './device-inspection.controller.js';
import { DeviceNotificationsController } from './device-notifications.controller.js';
import { DeviceCommandsController } from './device-commands.controller.js';
import { DeviceConfigurationController } from './device-configuration.controller.js';
import { DeviceTokenGuard } from './device-token.guard.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [
    HealthController,
    DeviceReportsController,
    DeviceStatusController,
    DeviceInspectionController,
    DeviceNotificationsController,
    DeviceCommandsController,
    DeviceConfigurationController,
  ],
  providers: [DeviceTokenGuard],
})
export class AppModule {}
