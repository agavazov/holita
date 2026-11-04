import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DeviceCaptureService } from './device-capture.service.js';
import { DeviceListener } from './device-listener.js';
import type { DeviceCommand } from './command.js';

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicesService.name);
  private readonly listener: DeviceListener;

  constructor(private readonly capture: DeviceCaptureService) {
    this.listener = new DeviceListener(
      capture.config,
      (entry, reason) => {
        capture.record(entry, reason);
      },
      {
        sent: (connection, command) => {
          capture.commandSent(connection, command);
        },
        finished: (connection, id, outcome) => {
          capture.commandFinished(connection, id, outcome);
        },
      },
    );
    this.listener.server.on('error', (error) => {
      this.logger.error(error.message);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.capture.initialize();
    await this.listener.start();
    const { host, port, upstream } = this.capture.config;
    this.logger.log(`Device listener on ${host}:${String(port)} → ${upstream}`);
  }

  listUnits() {
    return this.listener.listUnits();
  }

  sendCommand(unitId: string, command: DeviceCommand) {
    return this.listener.sendCommand(unitId, command);
  }

  sendRecordedGlobals(unitId: string, command: DeviceCommand) {
    return this.listener.sendRecordedGlobals(unitId, command);
  }

  async onModuleDestroy(): Promise<void> {
    await this.listener.stop();
    await this.capture.drain();
  }
}
