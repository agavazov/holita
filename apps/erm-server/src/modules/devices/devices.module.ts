import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DeviceCaptureService } from './device-capture.service.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';
import { InternalDevicesController } from './internal-devices.controller.js';
import { InternalDevicesGuard } from './internal-devices.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalDevicesController],
  providers: [DevicesRepository, DeviceCaptureService, DevicesService, InternalDevicesGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
