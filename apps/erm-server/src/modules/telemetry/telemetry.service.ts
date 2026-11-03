import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getArgumentValues, type GraphQLResolveInfo } from 'graphql';
import { setTimeout } from 'node:timers/promises';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  ErmHistoryInput,
  ErmUnitsInput,
  ErmDeviceEventsInput,
  ErmDevicePageInput,
  SendErmDeviceCommandInput,
  FleetDevice,
  ErmUnitState,
} from '../../generated/graphql/types.js';
import type { ErmEvent, ErmFrame, ErmCommand } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { validateCommand } from '../devices/command.js';
import { eventClassification } from '../../starlink/event-catalog.js';
import { LiveDevicesService, type LiveUnit } from './live-devices.service.js';
import { FleetClient } from './fleet.client.js';
import { deviceActions } from './device-actions.js';
import { deviceTelemetryRequest, type DeviceTelemetryRequest } from './device-request.js';
import { displayText } from './display-text.js';
import { deviceTelemetryQueries, telemetryPage, telemetryQuery } from './telemetry-query.js';
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
    ...eventClassification(event.eventId),
  };
}

function frameView(frame: ErmFrame) {
  return {
    ...frame,
    id: String(frame.id),
    receivedAt: frame.receivedAt.toISOString(),
    displayText: displayText(frame.raw),
  };
}

function commandView(command: ErmCommand) {
  return {
    ...command,
    sentAt: command.sentAt.toISOString(),
    answeredAt: command.answeredAt?.toISOString() ?? null,
    responseText: command.response === null ? null : displayText(command.response),
  };
}

export type DeviceReference = Pick<FleetDevice, 'id' | 'imei'> & {
  telemetryRequest: DeviceTelemetryRequest;
};

@Injectable()
export class TelemetryService {
  private readonly liveRequests = new WeakMap<RequestContext, Promise<LiveUnit[]>>();
  private readonly deviceRequests = new WeakMap<
    RequestContext,
    Map<string, DeviceTelemetryRequest>
  >();

  constructor(
    private readonly repository: TelemetryRepository,
    private readonly devices: LiveDevicesService,
    private readonly fleet: FleetClient,
  ) {}

  private liveUnits(context: RequestContext) {
    let request = this.liveRequests.get(context);
    if (!request) {
      request = this.devices.listUnits();
      this.liveRequests.set(context, request);
    }
    return request;
  }

  reference(
    reference: Pick<FleetDevice, 'id' | 'imei'>,
    context: RequestContext,
    info: GraphQLResolveInfo,
  ): DeviceReference {
    requireTenant(context);
    if (!/^\d{15}$/.test(reference.imei)) {
      throw new BadRequestException('Fleet Device representation requires its IMEI');
    }
    let requests = this.deviceRequests.get(context);
    if (!requests) {
      requests = new Map();
      this.deviceRequests.set(context, requests);
    }
    const key = String(info.path.key);
    let request = requests.get(key);
    if (!request) {
      const field = info.schema.getQueryType()?.getFields()['_entities'];
      const node = info.fieldNodes[0];
      const args: unknown =
        field && node ? getArgumentValues(field, node, info.variableValues) : undefined;
      const unitIds =
        typeof args === 'object' &&
        args !== null &&
        'representations' in args &&
        Array.isArray(args.representations)
          ? args.representations.flatMap((value: unknown) =>
              typeof value === 'object' &&
              value !== null &&
              '__typename' in value &&
              value.__typename === 'FleetDevice' &&
              'imei' in value &&
              typeof value.imei === 'string' &&
              /^\d{15}$/.test(value.imei)
                ? [value.imei]
                : [],
            )
          : [reference.imei];
      request = deviceTelemetryRequest(unitIds);
      requests.set(key, request);
    }
    return { ...reference, telemetryRequest: request };
  }

  async deviceState(device: DeviceReference, context: RequestContext) {
    requireTenant(context);
    const request = device.telemetryRequest;
    request.states ??= this.loadStates(request.unitIds, context);
    return (await request.states).get(device.imei) ?? null;
  }

  private async loadStates(unitIds: string[], context: RequestContext) {
    const [rows, live] = await Promise.all([
      this.repository.deviceStates(unitIds, new Date()),
      this.liveUnits(context),
    ]);
    const connected = new Map(live.map((unit) => [unit.unitId, unit]));
    return new Map(
      rows.map((row): [string, ErmUnitState | null] => {
        const unit = connected.get(row.unitId);
        return [
          row.unitId,
          !unit && row.connectionId === null
            ? null
            : {
                unitId: row.unitId,
                online: unit !== undefined,
                mode: unit?.mode === 'primary' ? 'PRIMARY' : unit ? 'MIRROR' : null,
                connectedSince: unit?.connectedSince ?? null,
                lastFrameAt: unit?.lastFrameAt ?? row.lastFrameAt?.toISOString() ?? null,
                latestEvent: row.latestEvent ? eventView(row.latestEvent) : null,
                lastPosition: row.lastPosition ? eventView(row.lastPosition) : null,
                latestAlarm: row.latestAlarm ? eventView(row.latestAlarm) : null,
                alarmsLast24h: row.alarmsLast24h,
              },
        ];
      }),
    );
  }

  async deviceEvents(
    device: DeviceReference,
    input: ErmDeviceEventsInput | null | undefined,
    context: RequestContext,
  ) {
    requireTenant(context);
    telemetryQuery('events', { ...input, unitId: device.imei }, input?.categories);
    const request = device.telemetryRequest;
    const key = JSON.stringify(input ?? {});
    let page = request.events.get(key);
    if (!page) {
      const queries = deviceTelemetryQueries('events', request.unitIds, input, input?.categories);
      page = this.repository
        .deviceEvents(queries, input?.categories)
        .then(
          (rows) =>
            new Map(
              rows.map(({ query, rows: events }) => [
                query.unitId ?? '',
                telemetryPage(events.map(eventView), query),
              ]),
            ),
        );
      request.events.set(key, page);
    }
    return (await page).get(device.imei);
  }

  async deviceFrames(
    device: DeviceReference,
    input: ErmDevicePageInput | null | undefined,
    context: RequestContext,
  ) {
    requireTenant(context);
    telemetryQuery('frames', { ...input, unitId: device.imei });
    const request = device.telemetryRequest;
    const key = JSON.stringify(input ?? {});
    let page = request.frames.get(key);
    if (!page) {
      const queries = deviceTelemetryQueries('frames', request.unitIds, input);
      page = this.repository
        .deviceFrames(queries)
        .then(
          (rows) =>
            new Map(
              rows.map(({ query, rows: frames }) => [
                query.unitId ?? '',
                telemetryPage(frames.map(frameView), query),
              ]),
            ),
        );
      request.frames.set(key, page);
    }
    return (await page).get(device.imei);
  }

  async deviceCommands(
    device: DeviceReference,
    input: ErmDevicePageInput | null | undefined,
    context: RequestContext,
  ) {
    requireTenant(context);
    telemetryQuery('commands', { ...input, unitId: device.imei });
    const request = device.telemetryRequest;
    const key = JSON.stringify(input ?? {});
    let page = request.commands.get(key);
    if (!page) {
      const queries = deviceTelemetryQueries('commands', request.unitIds, input);
      page = this.repository
        .deviceCommands(queries)
        .then(
          (rows) =>
            new Map(
              rows.map(({ query, rows: commands }) => [
                query.unitId ?? '',
                telemetryPage(commands.map(commandView), query),
              ]),
            ),
        );
      request.commands.set(key, page);
    }
    return (await page).get(device.imei);
  }

  async sendDeviceCommand(input: SendErmDeviceCommandInput, context: RequestContext) {
    requireTenant(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    const id = await this.devices.sendCommand(unitId, validateCommand(deviceActions[input.action]));
    // The gateway records asynchronously; wait briefly for its queued command outcome.
    for (let attempt = 0; attempt < 20; attempt++) {
      const command = await this.repository.command(id);
      if (command && (command.status !== 'SENT' || attempt === 19)) {
        return commandView(command);
      }
      await setTimeout(100);
    }
    throw new ServiceUnavailableException(
      'ERM command was sent but its record is not available yet; check command history',
    );
  }

  async units(input: ErmUnitsInput | null | undefined, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('units', input);
    const rows = await this.repository.units(query);
    const connected = new Map((await this.liveUnits(context)).map((unit) => [unit.unitId, unit]));
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
    return telemetryPage(rows.map(frameView), query);
  }

  async commands(input: ErmHistoryInput, context: RequestContext) {
    requireTenant(context);
    const query = telemetryQuery('commands', input);
    const rows = await this.repository.commands(query);
    return telemetryPage(rows.map(commandView), query);
  }
}
