import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getArgumentValues, type GraphQLResolveInfo } from 'graphql';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  ErmDeviceEventsInput,
  ErmDevicePageInput,
  SendErmDeviceCommandInput,
  FleetDevice,
  ErmUnitState,
  ErmFleetDiagnostic,
  ErmFleetProblems,
  ErmFleetTelemetry,
  QueryErmFleetProblemsArgs,
} from '../../generated/graphql/types.js';
import type { ErmEvent, ErmCommand } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { parseFrame } from '../../starlink/protocol.js';
import { eventClassification, eventName } from '../../starlink/event-catalog.js';
import { LiveDevicesService, type LiveUnit } from './live-devices.service.js';
import { deviceTelemetryRequest, type DeviceTelemetryRequest } from './device-request.js';
import { commandView, frameView } from './command-evidence.js';
import { deviceTelemetryQueries, telemetryPage, telemetryQuery } from './telemetry-query.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { edataParameterLabel } from './edata-catalog.js';
import { CommandRequestsService } from './command-requests.service.js';
import { FleetClient } from './fleet.client.js';
import { operatorScope } from './operator-audit.js';

// Fleet's telemetry feed carries only the eData reports it imports, in the shapes agreed for
// ADR 0008; any other report, or a value outside those shapes, is null.
function feedEdata(value: unknown) {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }
  if (value.type === 405 || value.type === 415) {
    if (!('parameters' in value) || !Array.isArray(value.parameters)) {
      return null;
    }
    const parameters: unknown[] = value.parameters;
    const measurements = [];
    for (const parameter of parameters) {
      if (
        typeof parameter !== 'object' ||
        parameter === null ||
        !('parameter' in parameter) ||
        typeof parameter.parameter !== 'number' ||
        !Number.isInteger(parameter.parameter) ||
        parameter.parameter < 0 ||
        parameter.parameter > 65535 ||
        !('type' in parameter) ||
        typeof parameter.type !== 'number' ||
        !Number.isInteger(parameter.type) ||
        parameter.type < 0 ||
        parameter.type > 255 ||
        !('valueSize' in parameter) ||
        typeof parameter.valueSize !== 'number' ||
        ![1, 2, 4].includes(parameter.valueSize) ||
        !('valueHex' in parameter) ||
        typeof parameter.valueHex !== 'string' ||
        parameter.valueHex.length !== parameter.valueSize * 2 ||
        !/^[0-9a-f]+$/i.test(parameter.valueHex)
      ) {
        return null;
      }
      measurements.push({
        parameterId: parameter.parameter,
        parameterType: parameter.type,
        valueSize: parameter.valueSize,
        valueHex: parameter.valueHex,
      });
    }
    // 415 is the freeze frame captured with a fault report, in the 405 shape.
    return { report: value.type === 405 ? ('405' as const) : ('415' as const), measurements };
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
      report: '411' as const,
      can: (value.communicationMask & 1) !== 0,
      j1708: (value.communicationMask & 2) !== 0,
      obd: (value.communicationMask & 4) !== 0,
      obdMask: value.obdCommunicationMask,
      canError: value.canError !== 0,
      ignition: value.ignition,
    };
  }
  if (value.type === 417) {
    return 'noCanMessages' in value && value.noCanMessages === true
      ? { report: '417' as const, noCanMessages: true }
      : null;
  }
  if (value.type === 413 || value.type === 418) {
    if (!('faults' in value) || !Array.isArray(value.faults)) {
      return null;
    }
    const records: unknown[] = value.faults;
    const faults = [];
    for (const fault of records) {
      if (
        typeof fault !== 'object' ||
        fault === null ||
        !('code' in fault) ||
        typeof fault.code !== 'string' ||
        !('status' in fault) ||
        (fault.status !== 1 && fault.status !== 2)
      ) {
        return null;
      }
      faults.push({
        code: fault.code,
        status: fault.status === 1 ? 'ADDED' : 'DELETED',
      });
    }
    return { report: value.type === 413 ? ('413' as const) : ('418' as const), faults };
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
  return { report: '419' as const, faults };
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
    latitude: event.latitude?.toNumber() ?? null,
    longitude: event.longitude?.toNumber() ?? null,
    ...eventClassification(event.eventId),
  };
}

function numericReading(
  event: (ErmEvent & { frame: { receivedAt: Date } }) | null,
  value: number | null | undefined,
) {
  return event === null || value === null || value === undefined
    ? null
    : { value, observedAt: event.eventTime ?? event.frame.receivedAt };
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
      return { value: match[1], observedAt: command.answeredAt };
    }
  }
  return null;
}

export type DeviceReference = Pick<FleetDevice, 'id' | 'imei'> & {
  telemetryRequest: DeviceTelemetryRequest;
};

function requireInternalTelemetry(context: RequestContext): void {
  const token = process.env.ERM_TELEMETRY_TOKEN;
  if (!token || token.length < 32) {
    throw new ServiceUnavailableException('Internal telemetry access is disabled');
  }
  const authorization = context.authorization;
  const supplied =
    authorization !== undefined &&
    authorization.length <= 4096 &&
    authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
  if (
    !timingSafeEqual(
      createHash('sha256').update(token).digest(),
      createHash('sha256').update(supplied).digest(),
    )
  ) {
    throw new UnauthorizedException('Internal telemetry authentication required');
  }
}

function fleetUnitIds(imeis: string[]): string[] {
  if (imeis.length > 500 || imeis.some((imei) => !/^\d{15}$/.test(imei))) {
    throw new BadRequestException('Expected at most 500 valid telemetry IMEIs');
  }
  return [...new Set(imeis)];
}

function problemDiagnostics(fields: unknown): ErmFleetDiagnostic[] {
  const edata =
    typeof fields === 'object' && fields !== null && 'edata' in fields
      ? feedEdata(fields.edata)
      : null;
  if (edata?.report === '419') {
    return edata.faults.map((fault) => ({
      kind: 'DIAGNOSTIC_TROUBLE_CODE',
      troubleCode: `SPN ${String(fault.spn)} FMI ${String(fault.fmi)}`,
      status: fault.status === 'ADDED' ? 'ADDED' : 'DELETED',
    }));
  }
  if (edata?.report === '413' || edata?.report === '418') {
    return edata.faults.map((fault) => ({
      kind: 'DIAGNOSTIC_TROUBLE_CODE',
      troubleCode: fault.code,
      status: fault.status === 'ADDED' ? 'ADDED' : 'DELETED',
    }));
  }
  return edata?.report === '411' && edata.canError
    ? [{ kind: 'CAN_ERROR', troubleCode: null, status: null }]
    : [];
}

@Injectable()
export class TelemetryService {
  private readonly liveRequests = new WeakMap<RequestContext, Promise<LiveUnit[]>>();
  private readonly deviceRequests = new WeakMap<
    RequestContext,
    Map<string, Promise<DeviceTelemetryRequest>>
  >();

  constructor(
    private readonly repository: TelemetryRepository,
    private readonly devices: LiveDevicesService,
    private readonly commandRequests: CommandRequestsService,
    private readonly fleet: FleetClient,
  ) {}

  async fleetTelemetry(imeis: string[], context: RequestContext): Promise<ErmFleetTelemetry> {
    requireInternalTelemetry(context);
    const unitIds = fleetUnitIds(imeis);
    const asOf = new Date();
    if (!unitIds.length) {
      return { asOf, units: [] };
    }
    const [rows, live] = await Promise.all([
      this.repository.fleetUnitStates(unitIds, asOf),
      this.liveUnits(context),
    ]);
    const connected = new Map(live.map((unit) => [unit.unitId, unit]));
    return {
      asOf,
      units: rows.map((row) => {
        const unit = connected.get(row.unitId);
        const lastFrameAt = unit ? new Date(unit.lastFrameAt) : row.lastFrameAt;
        return {
          imei: row.unitId,
          connected: unit !== undefined,
          lastFrameAt,
          expectedIntervalSeconds: row.expectedIntervalSeconds,
          reporting:
            lastFrameAt !== null &&
            asOf.getTime() - lastFrameAt.getTime() <= row.expectedIntervalSeconds * 2 * 1000,
        };
      }),
    };
  }

  async fleetProblems(
    args: QueryErmFleetProblemsArgs,
    context: RequestContext,
  ): Promise<ErmFleetProblems> {
    requireInternalTelemetry(context);
    const unitIds = fleetUnitIds(args.imeis);
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
    const from = new Date(args.from);
    const to = new Date(args.to);
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 500;
    if (
      !uuid.test(args.tenantId) ||
      !uuid.test(args.branchId) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !instant.test(args.from) ||
      !instant.test(args.to) ||
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from > to
    ) {
      throw new BadRequestException('Invalid Fleet problems scope, period or page');
    }
    const asOf = new Date();
    const result = await this.repository.fleetProblems(
      unitIds,
      args.tenantId,
      args.branchId,
      from,
      to,
      asOf,
      offset,
      limit,
    );
    const totalCount = result.counts.reduce((total, group) => total + group.count, 0);
    return {
      asOf,
      totalCount,
      hasMore: offset + result.items.length < totalCount,
      counts: result.counts,
      items: result.items.map(({ fields, ...row }) => ({
        ...row,
        details: row.sourceKind === 'COMMAND' ? row.details : eventName(row.eventId, fields, 'EN'),
        diagnostics: problemDiagnostics(fields),
      })),
    };
  }

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

  async reference(
    reference: Pick<FleetDevice, 'id' | 'imei'>,
    context: RequestContext,
    info: GraphQLResolveInfo,
  ): Promise<DeviceReference | null> {
    requireTenant(context);
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (
      !uuid.test(context.branchId ?? '') ||
      !uuid.test(reference.id) ||
      !/^\d{15}$/.test(reference.imei)
    ) {
      return null;
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
      const representedDevices =
        typeof args === 'object' &&
        args !== null &&
        'representations' in args &&
        Array.isArray(args.representations)
          ? args.representations.flatMap((value: unknown) =>
              typeof value === 'object' &&
              value !== null &&
              '__typename' in value &&
              value.__typename === 'FleetDevice' &&
              'id' in value &&
              typeof value.id === 'string' &&
              uuid.test(value.id) &&
              'imei' in value &&
              typeof value.imei === 'string' &&
              /^\d{15}$/.test(value.imei)
                ? [{ id: value.id.toLowerCase(), imei: value.imei }]
                : [],
            )
          : [{ id: reference.id.toLowerCase(), imei: reference.imei }];
      request = this.scopedDeviceRequest(representedDevices, context);
      requests.set(key, request);
    }
    const telemetryRequest = await request;
    const id = reference.id.toLowerCase();
    if (
      !telemetryRequest.devices.some((device) => device.id === id && device.imei === reference.imei)
    ) {
      return null;
    }
    return { id, imei: reference.imei, telemetryRequest };
  }

  private async scopedDeviceRequest(
    representedDevices: Pick<FleetDevice, 'id' | 'imei'>[],
    context: RequestContext,
  ): Promise<DeviceTelemetryRequest> {
    const ownedDevices = await this.fleet.deviceImeis(
      representedDevices.map(({ id }) => id),
      context,
    );
    const devices = representedDevices.filter(({ id, imei }) => ownedDevices.get(id) === imei);
    return deviceTelemetryRequest(
      devices.map(({ imei }) => imei),
      devices,
    );
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
        const lastFrameAt = unit ? new Date(unit.lastFrameAt) : row.lastFrameAt;
        const lastFrameAgeSeconds =
          lastFrameAt === null
            ? null
            : Math.max(0, Math.floor((snapshot.getTime() - lastFrameAt.getTime()) / 1000));
        const expectedIntervalSeconds = row.expectedIntervalSeconds;
        return [
          row.unitId,
          !unit && row.connectionId === null && row.recovery === null
            ? null
            : {
                unitId: row.unitId,
                online: unit !== undefined,
                mode: unit?.mode === 'primary' ? 'PRIMARY' : unit ? 'MIRROR' : null,
                connectedSince: unit ? new Date(unit.connectedSince) : null,
                lastFrameAt,
                recovery: row.recovery,
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
                  gapsLast24h: row.gapsLast24h,
                  networkChangesLast24h: row.networkChangesLast24h,
                  latestNetworkChange: row.latestNetworkChange,
                  overdue:
                    lastFrameAgeSeconds === null ||
                    lastFrameAgeSeconds > 2 * expectedIntervalSeconds,
                  lastCloseReason: row.lastCloseReason,
                  lastClosedAt: row.lastClosedAt,
                  upstreamClosesLast24h: row.upstreamClosesLast24h,
                  karmaRoutingWritesLast24h: row.karmaRoutingWritesLast24h,
                  latestKarmaRoutingWrite: row.latestKarmaRoutingWrite
                    ? frameView(row.latestKarmaRoutingWrite, context)
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
      page = this.repository.deviceEvents(queries, input).then(
        (rows) =>
          new Map(
            rows.map(({ query, rows: events, total }) => [
              query.unitId,
              {
                ...telemetryPage(events.map(eventView), query),
                total,
                offset: query.offset,
                limit: query.pageSize,
              },
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
        .deviceFrames(queries, context.branchId ? operatorScope(context) : null, request.devices)
        .then(
          (rows) =>
            new Map(
              rows.map(({ query, rows: frames, total }) => [
                query.unitId,
                {
                  ...telemetryPage(
                    frames.map((frame) => ({
                      ...frameView(frame, context),
                      acknowledgement: frame.acknowledgement,
                    })),
                    query,
                  ),
                  total,
                  offset: query.offset,
                  limit: query.pageSize,
                },
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
      page = this.repository.deviceCommands(queries).then(
        (rows) =>
          new Map(
            rows.map(({ query, rows: commands }) => [
              query.unitId,
              telemetryPage(
                commands.map((command) => commandView(command, context)),
                query,
              ),
            ]),
          ),
      );
      request.commands.set(key, page);
    }
    return (await page).get(device.imei);
  }

  async sendDeviceCommand(input: SendErmDeviceCommandInput, context: RequestContext) {
    return this.commandRequests.request(input, context);
  }
}
