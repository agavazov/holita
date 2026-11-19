import { Module } from '@nestjs/common';
import { DeviceAdapters } from './device-adapters.js';
import { DiscocanDeviceAdapter } from './discocan/discocan-device-adapter.js';
import { ErmDeviceAdapterModule } from './erm/erm-device-adapter.module.js';

@Module({
  imports: [ErmDeviceAdapterModule],
  providers: [DeviceAdapters, DiscocanDeviceAdapter],
  exports: [DeviceAdapters],
})
export class DeviceAdaptersModule {}
