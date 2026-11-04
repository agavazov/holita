import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getArgumentValues, type GraphQLResolveInfo } from 'graphql';
import { setTimeout } from 'node:timers/promises';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  ErmDeviceEventsInput,
  ErmDevicePageInput,
  SendErmDeviceCommandInput,
  FleetDevice,
  ErmUnitState,
} from '../../generated/graphql/types.js';
import type { ErmEvent, ErmFrame, ErmCommand } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { validateCommand } from '../devices/command.js';
import { parseFrame } from '../../starlink/protocol.js';
import { eventClassification } from '../../starlink/event-catalog.js';
import { LiveDevicesService, type LiveUnit } from './live-devices.service.js';
import { FleetClient } from './fleet.client.js';
import { deviceActions } from './device-actions.js';
import { deviceTelemetryRequest, type DeviceTelemetryRequest } from './device-request.js';
import { displayText } from './display-text.js';
import { deviceTelemetryQueries, telemetryPage, telemetryQuery } from './telemetry-query.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { edataParameterLabel } from './edata-catalog.js';

// Fleet's telemetry feed carries only the eData reports it imports, in the shapes agreed for
// ADR 0008; any other report, or a value outside those shapes, is null.
function feedEdata(value: unknown) {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }
  if (
    value.type === 411 &&
    'communicationMask' in value &&
    typeof value.communicationMask === 'number' &&
    'obdCommunicationMask' in value &&
    typeof value.obdCommunicationMask === 'number' &&
    'canError' in value &&
    typeof value.canError === 'number' &&
    'ignition' in value &&
    (value.ignition === 0 || value.ignition === 1 || value.ignition === 2)
  ) {
    return {
      report: '411',
      can: (value.communicationMask & 1) !== 0,
      j1708: (value.communicationMask & 2) !== 0,
      obd: (value.communicationMask & 4) !== 0,
      obdMask: value.obdCommunicationMask,
      canError: value.canError !== 0,
      ignition: value.ignition,
    };
  }
  if (value.type !== 419 || !('faults' in value) || !Array.isArray(value.faults)) {
    return null;
  }
  const records: unknown[] = value.faults;
  const faults = [];
  for (const fault of records) {
    if (
      typeof fault !== 'object' ||
      fault === null ||
      !('spn' in fault) ||
      typeof fault.spn !== 'number' ||
      !('fmi' in fault) ||
      typeof fault.fmi !== 'number' ||
      !('status' in fault) ||
      (fault.status !== 1 && fault.status !== 2)
    ) {
      return null;
    }
    faults.push({
      spn: fault.spn,
      fmi: fault.fmi,
      status: fault.status === 1 ? 'ADDED' : 'DELETED',
    });
  }
  return { report: '419', faults };
}

function storedIgnition(fields: ErmEvent['fields']) {
  const value =
    typeof fields === 'object' && fields !== null && !Array.isArray(fields)
      ? fields['#IGN#']
      : undefined;
  return value === '1' ? true : value === '0' ? false : null;
}

function storedEdata(fields: ErmEvent['fields']) {
  return typeof fields === 'object' && fields !== null && !Array.isArray(fields)
    ? (fields['edata'] ?? null)
    : null;
}

function eventView(event: ErmEvent) {
  return {
    ...event,
    edata: storedEdata(event.fields),
    ignitionOn: storedIgnition(event.fields),
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

function numericReading(
  event: (ErmEvent & { frame: { receivedAt: Date } }) | null,
  value: number | null | undefined,
) {
  return event === null || value === null || value === undefined
    ? null
    : { value, observedAt: (event.eventTime ?? event.frame.receivedAt).toISOString() };
}

function signalQuality(event: ErmEvent | null): number | null {
  const fields = event?.fields;
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    return null;
  }
  const value = fields['#CSS#'];
  return typeof value === 'number' || typeof value === 'string' ? Number(value) : null;
}

function firmwareReading(command: ErmCommand | null) {
  if (!command || command.response === null || command.answeredAt === null) {
    return null;
  }
  const frame = parseFrame(Buffer.from(command.response));
  for (const field of frame?.fields ?? []) {
    const match = /(?:^|;)VER=([^;]*)/.exec(field.toString('latin1'));
    if (match?.[1] !== undefined) {
      return { value: match[1], observedAt: command.answeredAt.toISOString() };
    }
  }
  return null;
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

  async internalEvents(imei: string, after?: unknown, limit?: unknown) {
    const receivedBefore = new Date(Date.now() - 10_000);
    const cursor = after === undefined ? '0' : after;
    const pageSize = limit === undefined ? '500' : limit;
    if (
      !/^\d{15}$/.test(imei) ||
      typeof cursor !== 'string' ||
      !/^\d+$/.test(cursor) ||
      BigInt(cursor) > 9223372036854775807n ||
      typeof pageSize !== 'string' ||
      !/^\d+$/.test(pageSize) ||
      !Number.isInteger(Number(pageSize)) ||
      Number(pageSize) < 1 ||
      Number(pageSize) > 500
    ) {
      throw new BadRequestException('Invalid telemetry IMEI, cursor or limit');
    }
    const rows = await this.repository.internalEvents(
      imei,
      cursor,
      Number(pageSize),
      receivedBefore,
    );
    const events = rows.map((event) => ({
      ...event,
      ignitionOn: event.ignitionOn,
      edata: feedEdata(event.edata),
      eventTime: event.eventTime?.toISOString() ?? null,
      receivedAt: event.receivedAt.toISOString(),
    }));
    return { events, next: events.at(-1)?.id ?? cursor };
  }

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
    const snapshot = new Date();
    const [rows, live] = await Promise.all([
      this.repository.deviceStates(unitIds, snapshot),
      this.liveUnits(context),
    ]);
    const connected = new Map(live.map((unit) => [unit.unitId, unit]));
    return new Map(
      rows.map((row): [string, ErmUnitState | null] => {
        const unit = connected.get(row.unitId);
        const lastFrameAt = unit?.lastFrameAt ?? row.lastFrameAt?.toISOString() ?? null;
        const lastFrameAgeSeconds =
          lastFrameAt === null
            ? null
            : Math.max(
                0,
                Math.floor((snapshot.getTime() - new Date(lastFrameAt).getTime()) / 1000),
              );
        const expectedIntervalSeconds =
          row.latestEvent?.engineOn === true || (row.latestEvent?.speedKmh ?? 0) > 0 ? 300 : 3600;
        return [
          row.unitId,
          !unit && row.connectionId === null
            ? null
            : {
                unitId: row.unitId,
                online: unit !== undefined,
                mode: unit?.mode === 'primary' ? 'PRIMARY' : unit ? 'MIRROR' : null,
                connectedSince: unit?.connectedSince ?? null,
                lastFrameAt,
                latestEvent: row.latestEvent ? eventView(row.latestEvent) : null,
                lastPosition: row.lastPosition ? eventView(row.lastPosition) : null,
                latestAlarm: row.latestAlarm ? eventView(row.latestAlarm) : null,
                alarmsLast24h: row.alarmsLast24h,
                mainVoltage: numericReading(
                  row.mainVoltageEvent,
                  row.mainVoltageEvent?.mainVoltage,
                ),
                backupVoltage: numericReading(
                  row.backupVoltageEvent,
                  row.backupVoltageEvent?.backupVoltage,
                ),
                signalQuality: numericReading(
                  row.signalQualityEvent,
                  signalQuality(row.signalQualityEvent),
                ),
                firmwareVersion: firmwareReading(row.firmwareCommand),
                edataMeasurements: row.edataMeasurements.map((measurement) => ({
                  ...measurement,
                  ...edataParameterLabel(measurement.parameterId),
                })),
                health: {
                  lastFrameAgeSeconds,
                  expectedIntervalSeconds,
                  overdue:
                    lastFrameAgeSeconds === null ||
                    lastFrameAgeSeconds > 2 * expectedIntervalSeconds,
                  lastCloseReason: row.lastCloseReason,
                  lastClosedAt: row.lastClosedAt?.toISOString() ?? null,
                  upstreamClosesLast24h: row.upstreamClosesLast24h,
                  karmaRoutingWritesLast24h: row.karmaRoutingWritesLast24h,
                  latestKarmaRoutingWrite: row.latestKarmaRoutingWrite
                    ? frameView(row.latestKarmaRoutingWrite)
                    : null,
                },
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
                query.unitId,
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
                query.unitId,
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
                query.unitId,
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
    const { id } = await this.devices.sendCommand(
      unitId,
      validateCommand(deviceActions[input.action]),
    );
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
}
