import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import { ErmNotificationsClient } from './erm-notifications.client.js';
import { NotificationSourcesRepository } from './notification-sources.repository.js';

@Injectable()
export class NotificationsJobs {
  private readonly logger = new Logger(NotificationsJobs.name);

  constructor(
    private readonly sources: NotificationSourcesRepository,
    private readonly erm: ErmNotificationsClient,
    private readonly clock: FleetClock,
  ) {}

  @Cron('*/30 * * * * *', { name: 'notification-feed', waitForCompletion: true })
  async tick(): Promise<void> {
    if (process.env.FLEET_ENABLED === 'false') {
      return;
    }
    const now = this.clock.now();
    try {
      await this.sources.projectAlerts(now);
      if (!process.env.ERM_TELEMETRY_TOKEN) {
        return;
      }
      for (const device of await this.sources.devices()) {
        try {
          const scope = { tenantId: device.tenantId, branchId: device.branchId };
          const cutoff = await this.sources.cutoff(scope, now);
          const cursor = await this.sources.cursor(
            scope,
            `erm:${device.id}`,
            device.createdAt > cutoff ? device.createdAt : cutoff,
          );
          const since = cursor.since > cutoff ? cursor.since : cutoff;
          let after = cursor.position;
          for (let count = 0; count < 10; count++) {
            const page = await this.erm.page(device, since, after);
            await this.sources.importPage(device, page, now);
            after = page.next;
            if (!page.hasMore) {
              break;
            }
          }
        } catch {
          this.logger.warn(
            `Notification export failed for Device ${device.id}; retrying on a later tick.`,
          );
        }
      }
    } catch {
      this.logger.warn('Notification sources could not be read; retrying on a later tick.');
    }
  }

  @Cron('0 0 3 * * *', { name: 'notification-retention', timeZone: 'UTC', waitForCompletion: true })
  async cleanup(): Promise<void> {
    if (process.env.FLEET_ENABLED !== 'false') {
      await this.sources.cleanup(this.clock.now());
    }
  }
}
