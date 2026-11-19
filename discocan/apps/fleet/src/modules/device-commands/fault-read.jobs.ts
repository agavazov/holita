import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DevicesRepository } from '../devices/devices.repository.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';

@Injectable()
export class FaultReadJobs {
  private readonly logger = new Logger(FaultReadJobs.name);

  constructor(
    private readonly devices: DevicesRepository,
    private readonly adapters: DeviceAdapters,
  ) {}

  @Cron('0 */30 * * * *', {
    name: 'device-fault-reads',
    timeZone: 'Europe/Sofia',
    waitForCompletion: true,
  })
  async faultReads(): Promise<void> {
    const types = this.adapters.enabledTypes('requestFaultRead');
    if (types.length === 0) {
      return;
    }
    try {
      const devices = await this.devices.forScheduledFaultRead(types);
      for (const { id, tenantId, branchId, imei, type } of devices) {
        try {
          await this.adapters.for(type).requestFaultRead({
            tenantId,
            branchId,
            device: { id, imei },
            actorId: 'system:fault-scan',
            intent: 'Scheduled fault read',
          });
        } catch {
          this.logger.warn(`Fault read request failed for Device ${id}.`);
        }
      }
    } catch {
      this.logger.warn('Fault reads: the Device registry could not be read.');
    }
  }
}
