import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ErmTelemetryClient } from '../../integrations/erm/erm-telemetry.client.js';
import { ErmTelemetryRepository } from './erm-telemetry.repository.js';

export function ermTelemetryEnabled(): boolean {
  const value = process.env.FLEET_ERM_TELEMETRY_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_ERM_TELEMETRY_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

@Injectable()
export class ErmTelemetryJobs {
  private readonly logger = new Logger(ErmTelemetryJobs.name);

  constructor(
    private readonly repository: ErmTelemetryRepository,
    private readonly client: ErmTelemetryClient,
  ) {}

  @Cron('*/30 * * * * *', { name: 'erm-telemetry-import', waitForCompletion: true })
  async tick(): Promise<void> {
    if (!ermTelemetryEnabled()) {
      return;
    }
    try {
      for (const device of await this.repository.devices()) {
        try {
          let after = device.ermCursor?.lastEventId ?? 0n;
          for (let count = 0; count < 10; count++) {
            const page = await this.client.page(device.imei, after);
            await this.repository.importPage(device, page);
            after = page.next;
            if (page.events.length < 500) {
              break;
            }
          }
        } catch {
          this.logger.warn(
            `ERM telemetry import failed for Device ${device.id}; retrying on a later tick.`,
          );
        }
      }
    } catch {
      this.logger.warn('ERM telemetry Device registry could not be read.');
    }
  }

  // ERM queues the read only for primary units without a pending one; each request waits for
  // the unit's connection and expires before the next run.
  @Cron('0 0 */6 * * *', {
    name: 'erm-fault-reads',
    timeZone: 'Europe/Sofia',
    waitForCompletion: true,
  })
  async faultReads(): Promise<void> {
    if (!ermTelemetryEnabled()) {
      return;
    }
    try {
      for (const device of await this.repository.devices()) {
        if (device.vehicleId === null) {
          continue;
        }
        try {
          await this.client.requestFaultRead(device);
        } catch {
          this.logger.warn(`ERM fault read request failed for Device ${device.id}.`);
        }
      }
    } catch {
      this.logger.warn('ERM fault reads: the Device registry could not be read.');
    }
  }
}
