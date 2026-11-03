import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InternalTelemetryGuard } from './internal-telemetry.guard.js';
import { TelemetryService } from './telemetry.service.js';

@Controller('internal/telemetry/units')
@UseGuards(InternalTelemetryGuard)
export class InternalTelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get(':imei/events')
  events(
    @Param('imei') imei: string,
    @Query('after') after: unknown,
    @Query('limit') limit: unknown,
  ) {
    return this.telemetry.internalEvents(imei, after, limit);
  }
}
