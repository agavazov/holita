import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { InternalTelemetryGuard } from '../telemetry/internal-telemetry.guard.js';
import { NotificationExportController } from './notification-export.controller.js';
import { NotificationExportRepository } from './notification-export.repository.js';
import { NotificationExportService } from './notification-export.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationExportController],
  providers: [InternalTelemetryGuard, NotificationExportRepository, NotificationExportService],
})
export class NotificationExportModule {}
