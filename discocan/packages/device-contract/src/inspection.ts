import {
  acknowledgement,
  array,
  boolean,
  date,
  imei,
  imeis,
  integer,
  malformed,
  nullable,
  number,
  object,
  oneOf,
  string,
  text,
} from './parse.js';
import { parseDeviceMeasurement, type DeviceMeasurement } from './reports.js';
import { SEVERITIES, type DeviceSeverity } from './status.js';

export const DEVICE_EVENT_CATEGORIES = [
  'POSITION',
  'STATUS',
  'ALARM',
  'DIAGNOSTIC',
  'OTHER',
] as const;
export const DEVICE_EVENT_SORT_FIELDS = ['TIME', 'CODE', 'SEVERITY'] as const;
export const DEVICE_SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
export const DEVICE_PAGE_SIZES = [25, 50, 100] as const;
const MESSAGE_DIRECTIONS = ['DEVICE', 'UPSTREAM', 'SERVER'] as const;
const CURSOR = /^[A-Za-z0-9_-]{1,1024}$/;

export type DeviceEventCategory = (typeof DEVICE_EVENT_CATEGORIES)[number];
export type DeviceEventSortField = (typeof DEVICE_EVENT_SORT_FIELDS)[number];
export type DeviceSortDirection = (typeof DEVICE_SORT_DIRECTIONS)[number];

export interface DevicePageRequest {
  pageSize: number;
  offset: number | null;
  cursor: string | null;
}

export interface DeviceEventsRequest extends DevicePageRequest {
  categories: DeviceEventCategory[] | null;
  severities: DeviceSeverity[] | null;
  sort: { field: DeviceEventSortField; direction: DeviceSortDirection };
}

export interface DeviceMessagesRequest extends DevicePageRequest {
  direction: DeviceSortDirection;
}

export interface DevicePage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DeviceEvent {
  id: string;
  messageId: string;
  imei: string;
  code: string | null;
  recordedAt: Date | null;
  positionAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  speedKph: number | null;
  headingDeg: number | null;
  odometerKm: number | null;
  engineOn: boolean | null;
  ignition: boolean | null;
  externalVoltage: number | null;
  backupBatteryVoltage: number | null;
  category: DeviceEventCategory;
  severity: DeviceSeverity;
  names: Record<'EN' | 'BG', string | null>;
}

export interface DeviceAcknowledgement {
  commandId: string;
  commandRequestId: string | null;
  resultCode: string;
  receivedAt: Date;
}

export interface DeviceMessage {
  id: string;
  connectionId: string;
  imei: string | null;
  direction: (typeof MESSAGE_DIRECTIONS)[number];
  receivedAt: Date;
  partial: boolean;
  displayText: string;
  payloadHex: string;
  acknowledgement: DeviceAcknowledgement | null;
}

export type DeviceEventPage = DevicePage<DeviceEvent>;
export type DeviceMessagePage = DevicePage<DeviceMessage>;

interface DeviceReading<T> {
  value: T;
  observedAt: Date;
}

export interface DeviceLatestMeasurement extends DeviceMeasurement {
  name: string | null;
  unit: string | null;
  observedAt: Date;
}

export interface DeviceHealthDetails {
  lastReportAgeSeconds: number | null;
  expectedIntervalSeconds: number;
  overdue: boolean;
  gapsLast24h: { from: Date; to: Date; durationSeconds: number; expectedIntervalSeconds: number }[];
  networkChangesLast24h: number;
  latestNetworkChange: { at: Date; networkType: string | null; operatorCode: string | null } | null;
  lastCloseReason: string | null;
  lastClosedAt: Date | null;
}

export interface DeviceState {
  imei: string;
  connected: boolean;
  connectedSince: Date | null;
  lastReportAt: Date | null;
  latestPosition: DeviceEvent | null;
  latestEvent: DeviceEvent | null;
  alarmsLast24h: number;
  latestAlarm: DeviceEvent | null;
  externalVoltage: DeviceReading<number> | null;
  backupBatteryVoltage: DeviceReading<number> | null;
  signalQuality: DeviceReading<number> | null;
  firmwareVersion: DeviceReading<string> | null;
  measurements: DeviceLatestMeasurement[];
  health: DeviceHealthDetails;
}

export interface DeviceStateRequest {
  imeis: string[];
}

export interface DeviceStateSnapshot {
  asOf: Date;
  devices: DeviceState[];
}

export function isDevicePageCursor(value: string): boolean {
  return CURSOR.test(value);
}

export function emptyDevicePage(request: DevicePageRequest): DevicePage<never> {
  return {
    items: [],
    total: 0,
    offset: request.offset ?? 0,
    limit: request.pageSize,
    cursor: request.cursor,
    nextCursor: null,
    hasMore: false,
  };
}

function pageRequest(row: Record<string, unknown>): DevicePageRequest {
  const pageSize =
    row.pageSize === undefined ? 50 : Number(text(row.pageSize, 'pageSize', /^\d+$/));
  const cursor = row.cursor === undefined ? null : text(row.cursor, 'cursor', CURSOR);
  const offset =
    row.offset === undefined
      ? null
      : integer(Number(text(row.offset, 'offset', /^\d+$/)), 'offset', 0, 2_147_483_647);
  if (
    !DEVICE_PAGE_SIZES.some((size) => size === pageSize) ||
    (cursor !== null && offset !== null)
  ) {
    return malformed('device page size or cursor');
  }
  return { pageSize, offset, cursor };
}

function queryValues<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T[] | null {
  if (value === undefined) {
    return null;
  }
  return value === ''
    ? []
    : text(value, field)
        .split(',')
        .map((item) => oneOf(item, field, allowed));
}

export function parseDeviceEventsRequest(unit: unknown, query: unknown): DeviceEventsRequest {
  imei(unit);
  const row = object(query, 'events query', [
    'pageSize',
    'offset',
    'cursor',
    'categories',
    'severities',
    'sortField',
    'sortDirection',
  ]);
  return {
    ...pageRequest(row),
    categories: queryValues(row.categories, 'categories', DEVICE_EVENT_CATEGORIES),
    severities: queryValues(row.severities, 'severities', SEVERITIES),
    sort: {
      field: oneOf(row.sortField ?? 'TIME', 'sortField', DEVICE_EVENT_SORT_FIELDS),
      direction: oneOf(row.sortDirection ?? 'DESC', 'sortDirection', DEVICE_SORT_DIRECTIONS),
    },
  };
}

export function parseDeviceMessagesRequest(unit: unknown, query: unknown): DeviceMessagesRequest {
  imei(unit);
  const row = object(query, 'messages query', ['pageSize', 'offset', 'cursor', 'direction']);
  return {
    ...pageRequest(row),
    direction: oneOf(row.direction ?? 'DESC', 'direction', DEVICE_SORT_DIRECTIONS),
  };
}

export function parseDeviceStateRequest(value: unknown): DeviceStateRequest {
  const row = object(value, 'state request', ['imeis']);
  return { imeis: imeis(row.imeis, 1) };
}

export function parseDeviceEvent(value: unknown): DeviceEvent {
  const row = object(value, 'event');
  const names = object(row.names, 'event names');
  return {
    id: text(row.id, 'id'),
    messageId: text(row.messageId, 'messageId'),
    imei: imei(row.imei),
    code: nullable(row.code, 'code', string),
    recordedAt: nullable(row.recordedAt, 'recordedAt', date),
    positionAt: nullable(row.positionAt, 'positionAt', date),
    latitude: nullable(row.latitude, 'latitude', number),
    longitude: nullable(row.longitude, 'longitude', number),
    speedKph: nullable(row.speedKph, 'speedKph', number),
    headingDeg: nullable(row.headingDeg, 'headingDeg', number),
    odometerKm: nullable(row.odometerKm, 'odometerKm', number),
    engineOn: nullable(row.engineOn, 'engineOn', boolean),
    ignition: nullable(row.ignition, 'ignition', boolean),
    externalVoltage: nullable(row.externalVoltage, 'externalVoltage', number),
    backupBatteryVoltage: nullable(row.backupBatteryVoltage, 'backupBatteryVoltage', number),
    category: oneOf(row.category, 'category', DEVICE_EVENT_CATEGORIES),
    severity: oneOf(row.severity, 'severity', SEVERITIES),
    names: { EN: nullable(names.EN, 'EN', string), BG: nullable(names.BG, 'BG', string) },
  };
}

export function parseDeviceMessage(value: unknown): DeviceMessage {
  const row = object(value, 'message');
  const payloadHex = string(row.payloadHex, 'payloadHex');
  if (!/^(?:[0-9a-f]{2})*$/i.test(payloadHex)) {
    return malformed('payloadHex');
  }
  return {
    id: text(row.id, 'id'),
    connectionId: text(row.connectionId, 'connectionId'),
    imei: row.imei === null ? null : imei(row.imei),
    direction: oneOf(row.direction, 'direction', MESSAGE_DIRECTIONS),
    receivedAt: date(row.receivedAt, 'receivedAt'),
    partial: boolean(row.partial, 'partial'),
    displayText: string(row.displayText, 'displayText'),
    payloadHex,
    acknowledgement: nullable(row.acknowledgement, 'acknowledgement', (value) =>
      acknowledgement(value, text),
    ),
  };
}

function page<T extends { imei: string | null }>(
  value: unknown,
  unit: string,
  request: DevicePageRequest,
  parse: (value: unknown) => T,
): DevicePage<T> {
  const row = object(value, 'device page');
  const items = array(row.items, 'items', parse);
  const total = integer(row.total, 'total');
  const offset = integer(row.offset, 'offset');
  const limit = integer(row.limit, 'limit');
  const cursor = nullable(row.cursor, 'cursor', (value, field) => text(value, field, CURSOR));
  const nextCursor = nullable(row.nextCursor, 'nextCursor', (value, field) =>
    text(value, field, CURSOR),
  );
  const hasMore = boolean(row.hasMore, 'hasMore');
  if (
    limit !== request.pageSize ||
    cursor !== request.cursor ||
    (cursor === null && offset !== (request.offset ?? 0)) ||
    items.length > Math.min(limit, Math.max(0, total - offset)) ||
    hasMore !== offset + items.length < total ||
    hasMore !== (nextCursor !== null) ||
    items.some((item) => item.imei !== null && item.imei !== unit)
  ) {
    return malformed('device page');
  }
  return { items, total, offset, limit, cursor, nextCursor, hasMore };
}

export function parseDeviceEventPage(
  value: unknown,
  unit: string,
  request: DeviceEventsRequest,
): DeviceEventPage {
  return page(value, unit, request, parseDeviceEvent);
}

export function parseDeviceMessagePage(
  value: unknown,
  unit: string,
  request: DeviceMessagesRequest,
): DeviceMessagePage {
  return page(value, unit, request, parseDeviceMessage);
}

function reading<T>(
  value: unknown,
  parse: (value: unknown, field: string) => T,
): DeviceReading<T> | null {
  if (value === null) {
    return null;
  }
  const row = object(value, 'reading');
  return { value: parse(row.value, 'value'), observedAt: date(row.observedAt, 'observedAt') };
}

function health(value: unknown): DeviceHealthDetails {
  const row = object(value, 'health');
  return {
    lastReportAgeSeconds: nullable(row.lastReportAgeSeconds, 'lastReportAgeSeconds', integer),
    expectedIntervalSeconds: integer(row.expectedIntervalSeconds, 'expectedIntervalSeconds'),
    overdue: boolean(row.overdue, 'overdue'),
    gapsLast24h: array(row.gapsLast24h, 'gapsLast24h', (value) => {
      const gap = object(value, 'data gap');
      return {
        from: date(gap.from, 'from'),
        to: date(gap.to, 'to'),
        durationSeconds: integer(gap.durationSeconds, 'durationSeconds'),
        expectedIntervalSeconds: integer(gap.expectedIntervalSeconds, 'expectedIntervalSeconds'),
      };
    }),
    networkChangesLast24h: integer(row.networkChangesLast24h, 'networkChangesLast24h'),
    latestNetworkChange: nullable(row.latestNetworkChange, 'latestNetworkChange', (value) => {
      const change = object(value, 'network change');
      return {
        at: date(change.at, 'at'),
        networkType: nullable(change.networkType, 'networkType', string),
        operatorCode: nullable(change.operatorCode, 'operatorCode', string),
      };
    }),
    lastCloseReason: nullable(row.lastCloseReason, 'lastCloseReason', string),
    lastClosedAt: nullable(row.lastClosedAt, 'lastClosedAt', date),
  };
}

export function parseDeviceState(value: unknown): DeviceState {
  const row = object(value, 'device state');
  const unit = imei(row.imei);
  const latestPosition = nullable(row.latestPosition, 'latestPosition', parseDeviceEvent);
  const latestEvent = nullable(row.latestEvent, 'latestEvent', parseDeviceEvent);
  const latestAlarm = nullable(row.latestAlarm, 'latestAlarm', parseDeviceEvent);
  if ([latestPosition, latestEvent, latestAlarm].some((item) => item && item.imei !== unit)) {
    return malformed('state event scope');
  }
  return {
    imei: unit,
    connected: boolean(row.connected, 'connected'),
    connectedSince: nullable(row.connectedSince, 'connectedSince', date),
    lastReportAt: nullable(row.lastReportAt, 'lastReportAt', date),
    latestPosition,
    latestEvent,
    alarmsLast24h: integer(row.alarmsLast24h, 'alarmsLast24h'),
    latestAlarm,
    externalVoltage: reading(row.externalVoltage, number),
    backupBatteryVoltage: reading(row.backupBatteryVoltage, number),
    signalQuality: reading(row.signalQuality, number),
    firmwareVersion: reading(row.firmwareVersion, string),
    measurements: array(row.measurements, 'measurements', (value) => {
      const measurement = object(value, 'measurement');
      return {
        ...parseDeviceMeasurement(measurement),
        name: nullable(measurement.name, 'name', string),
        unit: nullable(measurement.unit, 'unit', string),
        observedAt: date(measurement.observedAt, 'observedAt'),
      };
    }),
    health: health(row.health),
  };
}

export function parseDeviceStateSnapshot(
  value: unknown,
  request: DeviceStateRequest,
): DeviceStateSnapshot {
  const row = object(value, 'state snapshot');
  const devices = array(row.devices, 'devices', parseDeviceState);
  if (
    new Set(devices.map((entry) => entry.imei)).size !== devices.length ||
    devices.some((entry) => !request.imeis.includes(entry.imei))
  ) {
    return malformed('state device scope');
  }
  return { asOf: date(row.asOf, 'asOf'), devices };
}
