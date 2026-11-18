import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InternalTelemetryGuard } from '../telemetry/internal-telemetry.guard.js';
import { NotificationExportService } from './notification-export.service.js';

@Controller('internal/notifications/units')
@UseGuards(InternalTelemetryGuard)
export class NotificationExportController {
  constructor(private readonly notifications: NotificationExportService) {}

  @Get(':imei')
  page(
    @Param('imei') imei: string,
    @Query()
    query: {
      tenantId?: unknown;
      branchId?: unknown;
      deviceId?: unknown;
      since?: unknown;
      after?: unknown;
      limit?: unknown;
    },
  ) {
    return this.notifications.page(imei, query);
  }
}
