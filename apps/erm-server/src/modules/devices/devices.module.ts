import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DeviceCaptureService } from './device-capture.service.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [DevicesRepository, DeviceCaptureService, DevicesService],
})
export class DevicesModule {}
