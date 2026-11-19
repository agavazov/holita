import {
  parseDeviceActor,
  parseDevicePageCursor,
  parseDeviceScope,
  parseDeviceTarget,
  type DeviceCommandActor,
  type DeviceCommandBatchLookup,
  type DeviceCommandRequestHistory,
  type DeviceCommandScope,
  type DeviceCommandTarget,
} from './commands.js';
import {
  DEVICE_PAGE_SIZES,
  DEVICE_SORT_DIRECTIONS,
  type DevicePage,
  type DevicePageRequest,
  type DeviceSortDirection,
} from './inspection.js';
import {
  array,
  boolean,
  date,
  imei,
  integer,
  malformed,
  nullable,
  object,
  oneOf,
  string,
  text,
  uuid,
} from './parse.js';

export const DEVICE_CONFIGURATION_UNSUPPORTED = {
  code: 'UNSUPPORTED_VALUE',
  message: 'This Device type does not support parameter snapshots or controlled configuration.',
} as const;

export type DeviceConfigurationOutcome<T> = T | typeof DEVICE_CONFIGURATION_UNSUPPORTED;

const SNAPSHOT_STATUSES = ['RUNNING', 'COMPLETE', 'FAILED'] as const;
const READ_OUTCOMES = ['READ', 'REJECTED', 'OMITTED'] as const;
const CONFIGURATION_STATUSES = [
  'RUNNING',
  'READ',
  'VERIFIED',
  'MISMATCH',
  'RESTORED',
  'RESTORE_FAILED',
  'UNCERTAIN',
  'REFUSED',
  'FAILED',
] as const;
const CONFIGURATION_OPERATIONS = [
  'READ_MEASUREMENT_CONFIGURATION',
  'INTERVAL',
  'ADD_DEFINITION',
  'GLOBALS',
  'PARAMETER',
  'PARAMETERS',
] as const;
export const MEASUREMENT_CONFIGURATION_OPERATIONS = [
  'READ',
  'INTERVAL',
  'ADD_DEFINITION',
  'GLOBALS',
] as const;

export const MEASUREMENT_DEFINITION_HEX = /^[0-9a-f]{44}$/i;
export const MEASUREMENT_GLOBALS_HEX = /^[0-9a-f]{98}$/i;

export interface DeviceConfigurationAudit extends DeviceCommandActor {
  intent: string;
}

export interface StartDeviceParameterSnapshot extends DeviceConfigurationAudit {
  device: DeviceCommandTarget;
}

export interface DeviceParameterSnapshotsQuery
  extends DeviceCommandRequestHistory, DevicePageRequest {
  direction: DeviceSortDirection;
}

export interface DeviceParameterCatalogQuery extends DeviceCommandScope {
  search: string | null;
  writableOnly: boolean;
  offset: number;
  limit: number;
}

export type DeviceConfigurationHistoryQuery = DeviceCommandRequestHistory;

export type DeviceMeasurementConfigurationChange =
  | { operation: 'READ'; restoreAfter: false }
  | { operation: 'INTERVAL'; parameterId: number; intervalSeconds: number; restoreAfter: boolean }
  | { operation: 'ADD_DEFINITION'; definitionHex: string; restoreAfter: boolean }
  | { operation: 'GLOBALS'; globalsHex: string; restoreAfter: boolean };

export type StartDeviceMeasurementConfigurationChange = StartDeviceParameterSnapshot &
  DeviceMeasurementConfigurationChange;

export interface DeviceParameterWrite {
  parameterId: string;
  value: string;
}

export interface StartDeviceParameterChange
  extends StartDeviceParameterSnapshot, DeviceParameterWrite {
  restoreAfter: boolean;
}

export interface StartDeviceParametersChange extends StartDeviceParameterSnapshot {
  parameters: DeviceParameterWrite[];
  restoreAfter: boolean;
}

export interface StartDeviceConfigurationBatch extends DeviceConfigurationAudit {
  devices: DeviceCommandTarget[];
  parameters: DeviceParameterWrite[];
  restoreAfter: boolean;
}

export type DeviceConfigurationBatchLookup = DeviceCommandBatchLookup;
export type StopDeviceConfigurationBatch = DeviceConfigurationBatchLookup &
  DeviceConfigurationAudit;

export interface DeviceSnapshotValue {
  parameterId: string;
  title: string | null;
  value: string | null;
  outcome: (typeof READ_OUTCOMES)[number];
}

export interface DeviceParameterDifference {
  parameterId: string;
  title: string | null;
  previousValue: string | null;
  value: string | null;
}

export interface DeviceParameterSnapshot {
  id: string;
  imei: string;
  actorId: string | null;
  intent: string | null;
  status: (typeof SNAPSHOT_STATUSES)[number];
  startedAt: Date;
  finishedAt: Date | null;
  parameterCount: number;
  readCount: number;
  failureReason: string | null;
  values: DeviceSnapshotValue[];
  unreadParameterIds: string[];
  changes: DeviceParameterDifference[];
}

export type DeviceParameterSnapshotsPage = DevicePage<DeviceParameterSnapshot>;

export interface DeviceParameterDefinition {
  parameterId: string;
  title: string;
  summary: string | null;
  defaultValue: string | null;
  writable: boolean;
  options: { value: string; label: string }[];
}

export interface DeviceParameterCatalogPage {
  items: DeviceParameterDefinition[];
  total: number;
  offset: number;
  limit: number;
}

export interface DeviceMeasurementConfiguration {
  configurationId: string | null;
  observedAt: Date | null;
  definitions: { parameterId: number; intervalSeconds: number; definitionHex: string }[];
  globalsHex: string | null;
  profileId: number | null;
}

export interface DeviceConfigurationChange {
  id: string;
  imei: string;
  actorId: string | null;
  intent: string | null;
  operation: (typeof CONFIGURATION_OPERATIONS)[number];
  parameterIds: string[];
  measurementParameterId: number | null;
  batchId: string | null;
  batchIndex: number | null;
  status: (typeof CONFIGURATION_STATUSES)[number];
  startedAt: Date;
  finishedAt: Date | null;
  failureReason: string | null;
  measurementConfiguration: DeviceMeasurementConfiguration | null;
}

export interface DeviceConfigurationBatch {
  id: string;
  actorId: string;
  createdAt: Date;
  finishedAt: Date | null;
  stoppedAt: Date | null;
  stoppedByActorId: string | null;
  changes: DeviceConfigurationChange[];
}

const SCOPE = ['tenantId', 'branchId'];
const AUDIT = [...SCOPE, 'actorId', 'intent'];
const DEVICE = [...AUDIT, 'device'];
const PARAMETER_WRITE = ['parameterId', 'value'];

function supportedText(value: unknown, field: string): string {
  const parsed = text(value, field);
  return parsed.trim() && !parsed.includes('\0') ? parsed : malformed(field);
}

function audit(row: Record<string, unknown>): DeviceConfigurationAudit {
  return { ...parseDeviceActor(row), intent: supportedText(row.intent, 'intent') };
}

function startForDevice(row: Record<string, unknown>): StartDeviceParameterSnapshot {
  return { ...audit(row), device: parseDeviceTarget(row.device) };
}

function write(row: Record<string, unknown>): DeviceParameterWrite {
  const value = string(row.value, 'value');
  return {
    parameterId: supportedText(row.parameterId, 'parameterId'),
    value: value.includes('\0') ? malformed('value') : value,
  };
}

function writes(value: unknown): DeviceParameterWrite[] {
  const parameters = array(value, 'parameters', (item) =>
    write(object(item, 'parameter write', PARAMETER_WRITE)),
  );
  if (
    !parameters.length ||
    new Set(parameters.map(({ parameterId }) => parameterId)).size !== parameters.length
  ) {
    return malformed('parameters');
  }
  return parameters;
}

export function parseStartDeviceParameterSnapshot(value: unknown): StartDeviceParameterSnapshot {
  return startForDevice(object(value, 'snapshot start', DEVICE));
}

export function parseDeviceParameterSnapshotsQuery(value: unknown): DeviceParameterSnapshotsQuery {
  const row = object(value, 'snapshot history', [
    ...SCOPE,
    'device',
    'pageSize',
    'offset',
    'cursor',
    'direction',
  ]);
  const pageSize = integer(row.pageSize, 'pageSize');
  const offset = nullable(row.offset, 'offset', (value, field) =>
    integer(value, field, 0, 2_147_483_647),
  );
  const cursor = nullable(row.cursor, 'cursor', parseDevicePageCursor);
  if (
    !DEVICE_PAGE_SIZES.some((size) => size === pageSize) ||
    (offset !== null && cursor !== null)
  ) {
    return malformed('snapshot history page');
  }
  return {
    ...parseDeviceScope(row),
    device: parseDeviceTarget(row.device),
    pageSize,
    offset,
    cursor,
    direction: oneOf(row.direction, 'direction', DEVICE_SORT_DIRECTIONS),
  };
}

export function parseDeviceParameterCatalogQuery(value: unknown): DeviceParameterCatalogQuery {
  const row = object(value, 'parameter catalog query', [
    ...SCOPE,
    'search',
    'writableOnly',
    'offset',
    'limit',
  ]);
  return {
    ...parseDeviceScope(row),
    search: nullable(row.search, 'search', supportedText),
    writableOnly: boolean(row.writableOnly, 'writableOnly'),
    offset: integer(row.offset, 'offset', 0, 2_147_483_647),
    limit: integer(row.limit, 'limit', 1, 100),
  };
}

export function parseDeviceConfigurationHistoryQuery(
  value: unknown,
): DeviceConfigurationHistoryQuery {
  const row = object(value, 'configuration history', [...SCOPE, 'device']);
  return { ...parseDeviceScope(row), device: parseDeviceTarget(row.device) };
}

export function parseStartDeviceMeasurementConfigurationChange(
  value: unknown,
): StartDeviceMeasurementConfigurationChange {
  const row = object(value, 'measurement configuration change');
  const operation = oneOf(row.operation, 'operation', MEASUREMENT_CONFIGURATION_OPERATIONS);
  const keys = [...DEVICE, 'operation', 'restoreAfter'];
  const restoreAfter = boolean(row.restoreAfter, 'restoreAfter');
  const request = { ...startForDevice(row), restoreAfter };
  switch (operation) {
    case 'READ':
      object(row, 'measurement read', keys);
      return restoreAfter
        ? malformed('restoreAfter')
        : { ...request, operation, restoreAfter: false };
    case 'INTERVAL':
      object(row, 'interval change', [...keys, 'parameterId', 'intervalSeconds']);
      return {
        ...request,
        operation,
        parameterId: integer(row.parameterId, 'parameterId', 0, 65535),
        intervalSeconds: integer(row.intervalSeconds, 'intervalSeconds', 0, 65000),
      };
    case 'ADD_DEFINITION':
      object(row, 'add definition', [...keys, 'definitionHex']);
      return {
        ...request,
        operation,
        definitionHex: text(row.definitionHex, 'definitionHex', MEASUREMENT_DEFINITION_HEX),
      };
    case 'GLOBALS':
      object(row, 'globals change', [...keys, 'globalsHex']);
      return {
        ...request,
        operation,
        globalsHex: text(row.globalsHex, 'globalsHex', MEASUREMENT_GLOBALS_HEX),
      };
  }
}

export function parseStartDeviceParameterChange(value: unknown): StartDeviceParameterChange {
  const row = object(value, 'parameter change', [...DEVICE, ...PARAMETER_WRITE, 'restoreAfter']);
  return {
    ...startForDevice(row),
    ...write(row),
    restoreAfter: boolean(row.restoreAfter, 'restoreAfter'),
  };
}

export function parseStartDeviceParametersChange(value: unknown): StartDeviceParametersChange {
  const row = object(value, 'parameter set change', [...DEVICE, 'parameters', 'restoreAfter']);
  return {
    ...startForDevice(row),
    parameters: writes(row.parameters),
    restoreAfter: boolean(row.restoreAfter, 'restoreAfter'),
  };
}

export function parseStartDeviceConfigurationBatch(value: unknown): StartDeviceConfigurationBatch {
  const row = object(value, 'configuration batch start', [
    ...AUDIT,
    'devices',
    'parameters',
    'restoreAfter',
  ]);
  const devices = array(row.devices, 'devices', parseDeviceTarget);
  if (
    !devices.length ||
    devices.length > 100 ||
    new Set(devices.map(({ id }) => id)).size !== devices.length ||
    new Set(devices.map(({ imei }) => imei)).size !== devices.length
  ) {
    return malformed('devices');
  }
  return {
    ...audit(row),
    devices,
    parameters: writes(row.parameters),
    restoreAfter: boolean(row.restoreAfter, 'restoreAfter'),
  };
}

export function parseDeviceConfigurationBatchLookup(
  value: unknown,
): DeviceConfigurationBatchLookup {
  const row = object(value, 'configuration batch lookup', [...SCOPE, 'batchId']);
  return { ...parseDeviceScope(row), batchId: uuid(row.batchId, 'batchId') };
}

export function parseStopDeviceConfigurationBatch(value: unknown): StopDeviceConfigurationBatch {
  const row = object(value, 'configuration batch stop', [...AUDIT, 'batchId']);
  return { ...audit(row), batchId: uuid(row.batchId, 'batchId') };
}

export function parseDeviceSnapshotValue(value: unknown): DeviceSnapshotValue {
  const row = object(value, 'snapshot value');
  return {
    parameterId: supportedText(row.parameterId, 'parameterId'),
    title: nullable(row.title, 'title', string),
    value: nullable(row.value, 'value', string),
    outcome: oneOf(row.outcome, 'outcome', READ_OUTCOMES),
  };
}

export function parseDeviceParameterDifference(value: unknown): DeviceParameterDifference {
  const row = object(value, 'parameter difference');
  return {
    parameterId: supportedText(row.parameterId, 'parameterId'),
    title: nullable(row.title, 'title', string),
    previousValue: nullable(row.previousValue, 'previousValue', string),
    value: nullable(row.value, 'value', string),
  };
}

export function parseDeviceParameterSnapshot<
  V extends DeviceSnapshotValue = DeviceSnapshotValue,
  D extends DeviceParameterDifference = DeviceParameterDifference,
>(value: unknown, parseValue: (item: unknown) => V, parseDifference: (item: unknown) => D) {
  const row = object(value, 'parameter snapshot');
  return {
    id: uuid(row.id, 'id'),
    imei: imei(row.imei),
    actorId: nullable(row.actorId, 'actorId', text),
    intent: nullable(row.intent, 'intent', string),
    status: oneOf(row.status, 'status', SNAPSHOT_STATUSES),
    startedAt: date(row.startedAt, 'startedAt'),
    finishedAt: nullable(row.finishedAt, 'finishedAt', date),
    parameterCount: integer(row.parameterCount, 'parameterCount'),
    readCount: integer(row.readCount, 'readCount'),
    failureReason: nullable(row.failureReason, 'failureReason', string),
    values: array(row.values, 'values', parseValue),
    unreadParameterIds: array(row.unreadParameterIds, 'unreadParameterIds', (item) =>
      supportedText(item, 'parameterId'),
    ),
    changes: array(row.changes, 'changes', parseDifference),
  };
}

export function emptyDeviceParameterSnapshotsPage({
  pageSize,
  offset,
  cursor,
}: DevicePageRequest): DeviceParameterSnapshotsPage {
  return {
    items: [],
    total: 0,
    offset: offset ?? 0,
    limit: pageSize,
    cursor,
    nextCursor: null,
    hasMore: false,
  };
}

export function parseDeviceParameterSnapshotsPage<T = DeviceParameterSnapshot>(
  value: unknown,
  parse: (item: unknown) => T,
): DevicePage<T> {
  const row = object(value, 'snapshot page');
  return {
    items: array(row.items, 'items', parse),
    total: integer(row.total, 'total'),
    offset: integer(row.offset, 'offset'),
    limit: integer(row.limit, 'limit', 1, 100),
    cursor: nullable(row.cursor, 'cursor', parseDevicePageCursor),
    nextCursor: nullable(row.nextCursor, 'nextCursor', parseDevicePageCursor),
    hasMore: boolean(row.hasMore, 'hasMore'),
  };
}

export function parseDeviceParameterDefinition(value: unknown): DeviceParameterDefinition {
  const row = object(value, 'parameter definition');
  return {
    parameterId: supportedText(row.parameterId, 'parameterId'),
    title: text(row.title, 'title'),
    summary: nullable(row.summary, 'summary', string),
    defaultValue: nullable(row.defaultValue, 'defaultValue', string),
    writable: boolean(row.writable, 'writable'),
    options: array(row.options, 'options', (item) => {
      const option = object(item, 'parameter option');
      return { value: string(option.value, 'value'), label: string(option.label, 'label') };
    }),
  };
}

export function parseDeviceParameterCatalogPage<T = DeviceParameterDefinition>(
  value: unknown,
  parse: (item: unknown) => T,
) {
  const row = object(value, 'parameter catalog page');
  return {
    items: array(row.items, 'items', parse),
    total: integer(row.total, 'total'),
    offset: integer(row.offset, 'offset'),
    limit: integer(row.limit, 'limit', 1, 100),
  };
}

function measurementConfiguration(value: unknown): DeviceMeasurementConfiguration {
  const row = object(value, 'measurement configuration');
  return {
    configurationId: nullable(row.configurationId, 'configurationId', text),
    observedAt: nullable(row.observedAt, 'observedAt', date),
    definitions: array(row.definitions, 'definitions', (item) => {
      const definition = object(item, 'measurement definition');
      return {
        parameterId: integer(definition.parameterId, 'parameterId', 0, 65535),
        intervalSeconds: integer(definition.intervalSeconds, 'intervalSeconds', 0, 65535),
        definitionHex: text(definition.definitionHex, 'definitionHex', MEASUREMENT_DEFINITION_HEX),
      };
    }),
    globalsHex: nullable(row.globalsHex, 'globalsHex', (value, field) =>
      text(value, field, /^(?:[0-9a-f]{2})+$/i),
    ),
    profileId: nullable(row.profileId, 'profileId', (value, field) =>
      integer(value, field, 0, 65535),
    ),
  };
}

export function parseDeviceConfigurationChange(value: unknown): DeviceConfigurationChange {
  const row = object(value, 'configuration change');
  return {
    id: uuid(row.id, 'id'),
    imei: imei(row.imei),
    actorId: nullable(row.actorId, 'actorId', text),
    intent: nullable(row.intent, 'intent', string),
    operation: oneOf(row.operation, 'operation', CONFIGURATION_OPERATIONS),
    parameterIds: array(row.parameterIds, 'parameterIds', (item) =>
      supportedText(item, 'parameterId'),
    ),
    measurementParameterId: nullable(
      row.measurementParameterId,
      'measurementParameterId',
      (value, field) => integer(value, field, 0, 65535),
    ),
    batchId: nullable(row.batchId, 'batchId', uuid),
    batchIndex: nullable(row.batchIndex, 'batchIndex', integer),
    status: oneOf(row.status, 'status', CONFIGURATION_STATUSES),
    startedAt: date(row.startedAt, 'startedAt'),
    finishedAt: nullable(row.finishedAt, 'finishedAt', date),
    failureReason: nullable(row.failureReason, 'failureReason', string),
    measurementConfiguration: nullable(
      row.measurementConfiguration,
      'measurementConfiguration',
      measurementConfiguration,
    ),
  };
}

export function parseDeviceConfigurationHistory<T>(
  value: unknown,
  parse: (item: unknown) => T,
): T[] {
  return array(value, 'configuration history', parse);
}

export function parseDeviceConfigurationWritesEnabled(value: unknown): boolean {
  return boolean(value, 'configuration writes enabled');
}

export function parseDeviceConfigurationBatch<T = DeviceConfigurationChange>(
  value: unknown,
  parse: (item: unknown) => T,
) {
  const row = object(value, 'configuration batch');
  return {
    id: uuid(row.id, 'id'),
    actorId: text(row.actorId, 'actorId'),
    createdAt: date(row.createdAt, 'createdAt'),
    finishedAt: nullable(row.finishedAt, 'finishedAt', date),
    stoppedAt: nullable(row.stoppedAt, 'stoppedAt', date),
    stoppedByActorId: nullable(row.stoppedByActorId, 'stoppedByActorId', text),
    changes: array(row.changes, 'changes', parse),
  };
}

export function parseDeviceConfigurationBatchLookupResult<T>(
  value: unknown,
  parse: (item: unknown) => T,
): T | null {
  return nullable(object(value, 'configuration batch lookup result').item, 'item', parse);
}

export function parseDeviceConfigurationOutcome<T>(
  value: unknown,
  parse: (item: unknown) => T,
): DeviceConfigurationOutcome<T> {
  const row = object(value, 'configuration outcome');
  if (row.code === DEVICE_CONFIGURATION_UNSUPPORTED.code) {
    if (row.message !== DEVICE_CONFIGURATION_UNSUPPORTED.message) {
      return malformed('unsupported configuration outcome');
    }
    return DEVICE_CONFIGURATION_UNSUPPORTED;
  }
  return parse(row);
}
