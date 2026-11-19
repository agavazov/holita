import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FleetClock } from '../../clock/fleet-clock.js';
import { FleetDeviceType } from '../../generated/prisma/enums.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import {
  NotificationSourcesRepository,
  notificationSourceKey,
} from './notification-sources.repository.js';

@Injectable()
export class NotificationsJobs {
  private readonly logger = new Logger(NotificationsJobs.name);

  constructor(
    private readonly sources: NotificationSourcesRepository,
    private readonly adapters: DeviceAdapters,
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
      const types = Object.values(FleetDeviceType).filter((type) =>
        this.adapters.enabled(type, 'notifications'),
      );
      if (types.length === 0) {
        return;
      }
      for (const device of await this.sources.devices(types)) {
        try {
          const scope = { tenantId: device.tenantId, branchId: device.branchId };
          const cutoff = await this.sources.cutoff(scope, now);
          const cursor = await this.sources.cursor(
            scope,
            notificationSourceKey(device),
            device.createdAt > cutoff ? device.createdAt : cutoff,
          );
          const since = cursor.since > cutoff ? cursor.since : cutoff;
          let after = cursor.position;
          const adapter = this.adapters.for(device.type);
          for (let count = 0; count < 10; count++) {
            const page = await adapter.notifications({
              ...scope,
              deviceId: device.id,
              imei: device.imei,
              since,
              after,
              limit: 500,
            });
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
