import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { DevicesModule } from './modules/devices/devices.module.js';

@Module({ imports: [DevicesModule], controllers: [HealthController] })
export class AppModule {}
