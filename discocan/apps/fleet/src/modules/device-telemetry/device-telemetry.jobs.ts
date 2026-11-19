import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetDeviceType } from '../../generated/prisma/enums.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import { DeviceTelemetryRepository } from './device-telemetry.repository.js';

@Injectable()
export class DeviceTelemetryJobs {
  private readonly logger = new Logger(DeviceTelemetryJobs.name);

  constructor(
    private readonly repository: DeviceTelemetryRepository,
    private readonly adapters: DeviceAdapters,
  ) {}

  @Cron('*/30 * * * * *', { name: 'device-telemetry-import', waitForCompletion: true })
  async tick(): Promise<void> {
    const types = Object.values(FleetDeviceType).filter((type) =>
      this.adapters.enabled(type, 'reports'),
    );
    if (types.length === 0) {
      return;
    }
    try {
      for (const device of await this.repository.devices(types)) {
        try {
          let after = device.cursor?.lastEventId ?? 0n;
          const adapter = this.adapters.for(device.type);
          for (let count = 0; count < 10; count++) {
            const page = await adapter.reports(device.imei, after);
            await this.repository.importPage(device, page);
            after = page.next;
            if (page.reports.length < 500) {
              break;
            }
          }
        } catch {
          this.logger.warn(
            `Telemetry import failed for Device ${device.id}; retrying on a later tick.`,
          );
        }
      }
    } catch {
      this.logger.warn('Telemetry Device registry could not be read.');
    }
  }
}
