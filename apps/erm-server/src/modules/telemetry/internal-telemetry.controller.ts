import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandRequestsService } from './command-requests.service.js';
import { InternalTelemetryGuard } from './internal-telemetry.guard.js';
import { TelemetryService } from './telemetry.service.js';

@Controller('internal/telemetry/units')
@UseGuards(InternalTelemetryGuard)
export class InternalTelemetryController {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly commandRequests: CommandRequestsService,
  ) {}

  @Get(':imei/events')
  events(
    @Param('imei') imei: string,
    @Query('after') after: unknown,
    @Query('limit') limit: unknown,
  ) {
    return this.telemetry.internalEvents(imei, after, limit);
  }

  /** Fleet's scheduled fault-logger read; answers whether a request was queued. */
  @Post(':imei/fault-reads')
  @HttpCode(200)
  faultRead(@Param('imei') imei: string, @Body() body: unknown) {
    return this.commandRequests.scheduledFaultRead(imei, body);
  }
}
