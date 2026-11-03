import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DeviceCaptureService } from './device-capture.service.js';
import { DeviceListener } from './device-listener.js';

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicesService.name);
  private readonly listener: DeviceListener;

  constructor(private readonly capture: DeviceCaptureService) {
    this.listener = new DeviceListener(capture.config, (entry, reason) => {
      capture.record(entry, reason);
    });
    this.listener.server.on('error', (error) => {
      this.logger.error(error.message);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.capture.initialize();
    await this.listener.start();
    const { host, port, upstream } = this.capture.config;
    this.logger.log(`Mirror listener on ${host}:${String(port)} → ${upstream}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.listener.stop();
    await this.capture.drain();
  }
}
