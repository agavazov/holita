import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { ErmNotificationsClient } from './erm-notifications.client.js';
import { NotificationSourcesRepository } from './notification-sources.repository.js';
import { NotificationsJobs } from './notifications.jobs.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [DatabaseModule, ClockModule],
  providers: [
    FleetEnabledGuard,
    NotificationsRepository,
    NotificationsService,
    NotificationsResolver,
    NotificationSourcesRepository,
    ErmNotificationsClient,
    NotificationsJobs,
  ],
})
export class NotificationsModule {}
