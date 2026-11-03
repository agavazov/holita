import { Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { ErmHistoryInput, ErmUnitsInput } from '../../generated/graphql/types.js';
import type { ErmEvent } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DevicesService } from '../devices/devices.service.js';
import { displayText } from './display-text.js';
import { telemetryPage, telemetryQuery } from './telemetry-query.js';
import { TelemetryRepository } from './telemetry.repository.js';

function eventView(event: ErmEvent) {
  return {
    ...event,
    id: String(event.id),
    frameId: String(event.frameId),
    eventTime: event.eventTime?.toISOString() ?? null,
    positionTime: event.positionTime?.toISOString() ?? null,
    latitude: event.latitude?.toNumber() ?? null,
    longitude: event.longitude?.toNumber() ?? null,
  };
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly repository: TelemetryRepository,
    private readonly devices: DevicesService,
  ) {}

  async units(input: ErmUnitsInput | null | undefined, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('units', input);
    const rows = await this.repository.units(query);
    const connected = new Map(this.devices.listUnits().map((unit) => [unit.unitId, unit]));
    return telemetryPage(
      rows.map((row) => {
        const live = connected.get(row.unitId);
        return {
          unitId: row.unitId,
          connected: live !== undefined,
          mode: live?.mode === 'primary' ? 'PRIMARY' : live ? 'MIRROR' : null,
          peer: live?.peer ?? row.connection?.peer ?? '',
          connectedSince: live?.connectedSince ?? null,
          lastFrameAt: live?.lastFrameAt ?? row.lastFrameAt?.toISOString() ?? null,
          latestEvent: row.latestEvent ? eventView(row.latestEvent) : null,
        };
      }),
      query,
    );
  }

  async events(input: ErmHistoryInput, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('events', input);
    return telemetryPage((await this.repository.events(query)).map(eventView), query);
  }

  async frames(input: ErmHistoryInput, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('frames', input);
    const rows = await this.repository.frames(query);
    return telemetryPage(
      rows.map((frame) => ({
        ...frame,
        id: String(frame.id),
        receivedAt: frame.receivedAt.toISOString(),
        displayText: displayText(frame.raw),
      })),
      query,
    );
  }

  async commands(input: ErmHistoryInput, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('commands', input);
    const rows = await this.repository.commands(query);
    return telemetryPage(
      rows.map((command) => ({
        ...command,
        sentAt: command.sentAt.toISOString(),
        answeredAt: command.answeredAt?.toISOString() ?? null,
        responseText: command.response === null ? null : displayText(command.response),
      })),
      query,
    );
  }
}
