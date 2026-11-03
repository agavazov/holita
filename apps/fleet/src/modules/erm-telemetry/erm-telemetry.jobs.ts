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
}
