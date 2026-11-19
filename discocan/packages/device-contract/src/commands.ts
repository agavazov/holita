import type {
  DeviceAcknowledgement,
  DevicePageRequest,
  DeviceSortDirection,
} from './inspection.js';
import { DEVICE_PAGE_SIZES, DEVICE_SORT_DIRECTIONS, isDevicePageCursor } from './inspection.js';
import {
  acknowledgement,
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

export const DEVICE_ACTIONS = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_DIAGNOSTICS',
  'READ_FAULTS',
  'READ_PARAMETERS',
] as const;
export const DEVICE_COMMAND_REQUEST_STATUSES = [
  'QUEUED',
  'SUBMITTING',
  'ANSWERED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'UNCERTAIN',
] as const;
export const DEVICE_COMMAND_SORT_FIELDS = [
  'ACTION',
  'STATUS',
  'UNIT_ID',
  'ACTOR_ID',
  'REQUESTED_AT',
  'COMPLETED_AT',
] as const;
const WAITING_REASONS = [
  'GATEWAY_UNAVAILABLE',
  'FLEET_VERIFICATION_UNAVAILABLE',
  'UNIT_NOT_CONNECTED',
] as const;
const COMMAND_STATES = ['SENT', 'ANSWERED', 'TIMEOUT', 'FAILED'] as const;
const PARAMETER_OUTCOMES = ['READ', 'REJECTED', 'OMITTED'] as const;
const DISPLAY_FIELDS = [
  'IGNITION',
  'ENGINE',
  'VIN',
  'MAIN_VOLTAGE',
  'SIGNAL_QUALITY',
  'JAMMING',
  'FIRMWARE_VERSION',
] as const;
export const DEVICE_COMMAND_DEFAULT_EXPIRY = 7200;
export const DEVICE_COMMAND_MAX_EXPIRY = 86400;
export const DEVICE_COMMANDS_UNSUPPORTED = {
  code: 'UNSUPPORTED_VALUE',
  message: 'Device commands are not supported yet.',
} as const;

export type DeviceAction = (typeof DEVICE_ACTIONS)[number];
export type DeviceCommandRequestStatus = (typeof DEVICE_COMMAND_REQUEST_STATUSES)[number];
export type DeviceCommandSortField = (typeof DEVICE_COMMAND_SORT_FIELDS)[number];

export interface DeviceCommandScope {
  tenantId: string;
  branchId: string;
}

export interface DeviceCommandActor extends DeviceCommandScope {
  actorId: string;
}

export interface DeviceCommandTarget {
  id: string;
  imei: string;
}

export interface DeviceCommandOptions {
  expiresInSeconds: number;
  intent: string | null;
}

export interface CreateDeviceCommandRequest extends DeviceCommandActor, DeviceCommandOptions {
  device: DeviceCommandTarget;
  action: DeviceAction;
  parameters: number[];
}

export interface DeviceCommandRequestLookup extends DeviceCommandScope {
  requestId: string;
}

export interface CancelDeviceCommandRequest extends DeviceCommandActor, DeviceCommandRequestLookup {
  device: DeviceCommandTarget;
}

export interface RetryDeviceCommandRequest
  extends DeviceCommandActor, DeviceCommandRequestLookup, DeviceCommandOptions {}

export interface StartDeviceCommandBatch extends DeviceCommandActor, DeviceCommandOptions {
  devices: DeviceCommandTarget[];
  action: DeviceAction;
}

export interface DeviceCommandBatchLookup extends DeviceCommandScope {
  batchId: string;
}

export interface StopDeviceCommandBatch extends DeviceCommandActor, DeviceCommandBatchLookup {}

export interface DeviceCommandHistoryRequest extends DeviceCommandScope, DevicePageRequest {
  device: DeviceCommandTarget;
}

export interface DeviceCommandRequestsFilter {
  statuses?: DeviceCommandRequestStatus[];
  actions?: DeviceAction[];
  deviceIds?: string[];
  imeis?: string[];
  actorId?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface DeviceCommandRequestsQuery extends DeviceCommandScope {
  offset: number;
  limit: number;
  filter: DeviceCommandRequestsFilter;
  sort: { field: DeviceCommandSortField; direction: DeviceSortDirection };
}

export interface DeviceCommandRequestHistory extends DeviceCommandScope {
  device: DeviceCommandTarget;
}

export interface DeviceCommand {
  id: string;
  imei: string;
  connectionId: string;
  status: (typeof COMMAND_STATES)[number];
  sentAt: Date;
  answeredAt: Date | null;
  resultCode: string | null;
  responseText: string | null;
  acknowledgement: DeviceAcknowledgement | null;
}

export interface DeviceCommandRequest {
  id: string;
  deviceId: string;
  imei: string;
  actorId: string;
  cancelledByActorId: string | null;
  batchId: string | null;
  batchIndex: number | null;
  retryOfId: string | null;
  waitingReason: (typeof WAITING_REASONS)[number] | null;
  waitingSince: Date | null;
  intent: string;
  action: DeviceAction;
  parameters: number[];
  parameterValues: {
    parameter: number;
    title: string | null;
    value: string | null;
    resultCode: string | null;
    outcome: (typeof PARAMETER_OUTCOMES)[number];
  }[];
  actionCode: string;
  displayParameters: {
    expiresInSeconds: number;
    requestedFields: (typeof DISPLAY_FIELDS)[number][];
  };
  requestedAt: Date;
  queuedAt: Date;
  submittingAt: Date | null;
  sentAt: Date | null;
  answeredAt: Date | null;
  failedAt: Date | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  uncertainAt: Date | null;
  outcomeCode: string;
  reasonCode: string | null;
  transportCommand: DeviceCommand | null;
  status: DeviceCommandRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  commandId: string | null;
  resultCode: string | null;
  responseText: string | null;
  failureReason: string | null;
  faultReadVerdict: DeviceFaultReadVerdict | null;
}

export interface DeviceCommandRequestsPage<T = DeviceCommandRequest> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface DeviceCommandBatch<T = DeviceCommandRequest> {
  id: string;
  actorId: string;
  action: DeviceAction;
  createdAt: Date;
  stoppedAt: Date | null;
  stoppedByActorId: string | null;
  counts: { status: DeviceCommandRequestStatus; count: number }[];
  requests: T[];
}

export interface DeviceCommandsPage<T = DeviceCommand> {
  items: T[];
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DeviceActionCatalogEntry {
  action: DeviceAction;
  requiresParameters: boolean;
}

export interface DeviceFaultReadVerdict {
  activeCodes: boolean;
  codeCount: number | null;
  receivedAt: Date;
}

export interface DeviceFaultReadRequest extends DeviceCommandActor, DeviceCommandRequestHistory {
  intent: string;
}

export interface DeviceAnsweredFaultReadsQuery extends DeviceCommandScope {
  deviceIds: readonly string[];
  from: Date;
  to: Date;
  count: number;
}

export interface DeviceAnsweredFaultRead {
  id: string;
  deviceId: string;
  imei: string;
  completedAt: Date;
  verdict: DeviceFaultReadVerdict | null;
}

export interface DeviceAnsweredFaultReads {
  total: number;
  items: DeviceAnsweredFaultRead[];
}

export type DeviceCommandOutcome<T> = T | typeof DEVICE_COMMANDS_UNSUPPORTED;

const SCOPE = ['tenantId', 'branchId'];
const ACTOR = [...SCOPE, 'actorId'];
const OPTIONS = ['expiresInSeconds', 'intent'];

function scope(row: Record<string, unknown>): DeviceCommandScope {
  return { tenantId: uuid(row.tenantId, 'tenantId'), branchId: uuid(row.branchId, 'branchId') };
}

function boundedText(value: unknown, field: string, max: number): string {
  const parsed = text(value, field);
  return parsed.length <= max && !parsed.includes('\0') ? parsed : malformed(field);
}

function actor(row: Record<string, unknown>): DeviceCommandActor {
  return { ...scope(row), actorId: boundedText(row.actorId, 'actorId', 128) };
}

function options(row: Record<string, unknown>): DeviceCommandOptions {
  return {
    expiresInSeconds: integer(
      row.expiresInSeconds,
      'expiresInSeconds',
      1,
      DEVICE_COMMAND_MAX_EXPIRY,
    ),
    intent: nullable(row.intent, 'intent', (value, field) => boundedText(value, field, 200)),
  };
}

function target(value: unknown): DeviceCommandTarget {
  const row = object(value, 'Device target', ['id', 'imei']);
  return { id: uuid(row.id, 'deviceId'), imei: imei(row.imei) };
}

function unique<T>(items: T[], field: string): T[] {
  return items.length >= 1 && items.length <= 100 && new Set(items).size === items.length
    ? items
    : malformed(field);
}

function action(value: unknown): DeviceAction {
  return oneOf(value, 'action', DEVICE_ACTIONS);
}

function status(value: unknown): DeviceCommandRequestStatus {
  return oneOf(value, 'status', DEVICE_COMMAND_REQUEST_STATUSES);
}

export function parseCreateDeviceCommandRequest(value: unknown): CreateDeviceCommandRequest {
  const row = object(value, 'command request', [
    ...ACTOR,
    ...OPTIONS,
    'device',
    'action',
    'parameters',
  ]);
  const selected = action(row.action);
  const parameters = array(row.parameters, 'parameters', (item) =>
    integer(item, 'parameter', 1, 9999),
  );
  if (
    selected === 'READ_PARAMETERS'
      ? parameters.length < 1 ||
        parameters.length > 20 ||
        new Set(parameters).size !== parameters.length
      : parameters.length > 0
  ) {
    return malformed('parameters');
  }
  return {
    ...actor(row),
    ...options(row),
    device: target(row.device),
    action: selected,
    parameters,
  };
}

export function parseDeviceCommandRequestLookup(value: unknown): DeviceCommandRequestLookup {
  const row = object(value, 'command request lookup', [...SCOPE, 'requestId']);
  return { ...scope(row), requestId: uuid(row.requestId, 'requestId') };
}

export function parseCancelDeviceCommandRequest(value: unknown): CancelDeviceCommandRequest {
  const row = object(value, 'command cancellation', [...ACTOR, 'device', 'requestId']);
  return { ...actor(row), device: target(row.device), requestId: uuid(row.requestId, 'requestId') };
}

export function parseRetryDeviceCommandRequest(value: unknown): RetryDeviceCommandRequest {
  const row = object(value, 'command retry', [...ACTOR, ...OPTIONS, 'requestId']);
  return { ...actor(row), ...options(row), requestId: uuid(row.requestId, 'requestId') };
}

export function parseStartDeviceCommandBatch(value: unknown): StartDeviceCommandBatch {
  const row = object(value, 'command batch', [...ACTOR, ...OPTIONS, 'devices', 'action']);
  const devices = array(row.devices, 'devices', target);
  unique(
    devices.map(({ id }) => id),
    'devices',
  );
  const selected = action(row.action);
  if (selected === 'READ_PARAMETERS') {
    return malformed('batch action');
  }
  return { ...actor(row), ...options(row), devices, action: selected };
}

export function parseDeviceCommandBatchLookup(value: unknown): DeviceCommandBatchLookup {
  const row = object(value, 'command batch lookup', [...SCOPE, 'batchId']);
  return { ...scope(row), batchId: uuid(row.batchId, 'batchId') };
}

export function parseStopDeviceCommandBatch(value: unknown): StopDeviceCommandBatch {
  const row = object(value, 'command batch stop', [...ACTOR, 'batchId']);
  return { ...actor(row), batchId: uuid(row.batchId, 'batchId') };
}

export function parseDeviceCommandRequestsQuery(value: unknown): DeviceCommandRequestsQuery {
  const row = object(value, 'command queue', [...SCOPE, 'offset', 'limit', 'filter', 'sort']);
  const filter = object(row.filter, 'command filters', [
    'statuses',
    'actions',
    'deviceIds',
    'imeis',
    'actorId',
    'createdFrom',
    'createdTo',
  ]);
  const sort = object(row.sort, 'command sort', ['field', 'direction']);
  const from =
    filter.createdFrom === undefined ? undefined : date(filter.createdFrom, 'createdFrom');
  const to = filter.createdTo === undefined ? undefined : date(filter.createdTo, 'createdTo');
  if (from && to && from >= to) {
    return malformed('command creation range');
  }
  return {
    ...scope(row),
    offset: integer(row.offset, 'offset', 0, 2_147_483_647),
    limit: integer(row.limit, 'limit', 1, 100),
    filter: {
      ...(filter.statuses === undefined
        ? {}
        : { statuses: unique(array(filter.statuses, 'statuses', status), 'statuses') }),
      ...(filter.actions === undefined
        ? {}
        : { actions: unique(array(filter.actions, 'actions', action), 'actions') }),
      ...(filter.deviceIds === undefined
        ? {}
        : {
            deviceIds: unique(
              array(filter.deviceIds, 'deviceIds', (item) => uuid(item, 'deviceId')),
              'deviceIds',
            ),
          }),
      ...(filter.imeis === undefined
        ? {}
        : { imeis: unique(array(filter.imeis, 'imeis', imei), 'imeis') }),
      ...(filter.actorId === undefined
        ? {}
        : { actorId: boundedText(filter.actorId, 'actorId', 128) }),
      ...(from ? { createdFrom: from } : {}),
      ...(to ? { createdTo: to } : {}),
    },
    sort: {
      field: oneOf(sort.field, 'field', DEVICE_COMMAND_SORT_FIELDS),
      direction: oneOf(sort.direction, 'direction', DEVICE_SORT_DIRECTIONS),
    },
  };
}

export function parseDeviceCommandRequestHistory(value: unknown): DeviceCommandRequestHistory {
  const row = object(value, 'device request history', [...SCOPE, 'device']);
  return { ...scope(row), device: target(row.device) };
}

function pageCursor(value: unknown, field: string): string {
  const cursor = text(value, field);
  return isDevicePageCursor(cursor) ? cursor : malformed(field);
}

export function parseDeviceCommandHistoryRequest(value: unknown): DeviceCommandHistoryRequest {
  const row = object(value, 'command history', [
    ...SCOPE,
    'device',
    'pageSize',
    'offset',
    'cursor',
  ]);
  const pageSize = integer(row.pageSize, 'pageSize');
  const offset = nullable(row.offset, 'offset', (item, field) =>
    integer(item, field, 0, 2_147_483_647),
  );
  const cursor = nullable(row.cursor, 'cursor', pageCursor);
  if (
    !DEVICE_PAGE_SIZES.some((size) => size === pageSize) ||
    (offset !== null && cursor !== null)
  ) {
    return malformed('command history page');
  }
  return { ...scope(row), device: target(row.device), pageSize, offset, cursor };
}

export function parseDeviceActionCatalogRequest(value: unknown): DeviceCommandScope {
  return scope(object(value, 'action catalog request', SCOPE));
}

export function parseDeviceFaultReadRequest(value: unknown): DeviceFaultReadRequest {
  const row = object(value, 'scheduled fault read', [...ACTOR, 'device', 'intent']);
  return {
    ...actor(row),
    device: target(row.device),
    intent: boundedText(row.intent, 'intent', 200),
  };
}

export function parseDeviceAnsweredFaultReadsQuery(value: unknown): DeviceAnsweredFaultReadsQuery {
  const row = object(value, 'answered fault reads', [...SCOPE, 'deviceIds', 'from', 'to', 'count']);
  const from = date(row.from, 'from');
  const to = date(row.to, 'to');
  const deviceIds = unique(
    array(row.deviceIds, 'deviceIds', (item) => uuid(item, 'deviceId')),
    'deviceIds',
  );
  if (from >= to) {
    return malformed('fault read interval');
  }
  return { ...scope(row), deviceIds, from, to, count: integer(row.count, 'count', 1) };
}

export function parseDeviceFaultReadVerdict(value: unknown): DeviceFaultReadVerdict {
  const row = object(value, 'fault read verdict');
  return {
    activeCodes: boolean(row.activeCodes, 'activeCodes'),
    codeCount: nullable(row.codeCount, 'codeCount', integer),
    receivedAt: date(row.receivedAt, 'receivedAt'),
  };
}

export function parseDeviceAnsweredFaultReads(value: unknown): DeviceAnsweredFaultReads {
  const row = object(value, 'answered fault reads');
  return {
    total: integer(row.total, 'total'),
    items: array(row.items, 'items', (item) => {
      const read = object(item, 'answered fault read');
      return {
        id: uuid(read.id, 'id'),
        deviceId: uuid(read.deviceId, 'deviceId'),
        imei: imei(read.imei),
        completedAt: date(read.completedAt, 'completedAt'),
        verdict: nullable(read.verdict, 'verdict', parseDeviceFaultReadVerdict),
      };
    }),
  };
}

export function parseDeviceCommandLookup<T>(
  value: unknown,
  parse: (value: unknown) => T,
): T | null {
  const row = object(value, 'command lookup result');
  return nullable(row.item, 'item', parse);
}

export function parseDeviceCommandRequestHistoryResult<T>(
  value: unknown,
  parse: (value: unknown) => T,
): T[] {
  return array(value, 'command request history', parse);
}

export function parseDeviceFaultReadOutcome(
  value: unknown,
): DeviceCommandOutcome<{ queued: boolean }> {
  return parseDeviceCommandOutcome(value, (item) => {
    const row = object(item, 'scheduled fault read result');
    return { queued: boolean(row.queued, 'queued') };
  });
}

export function parseDeviceCommandOutcome<T>(
  value: unknown,
  parse: (value: unknown) => T,
): DeviceCommandOutcome<T> {
  const row = object(value, 'command outcome');
  if (row.code === DEVICE_COMMANDS_UNSUPPORTED.code) {
    if (row.message !== DEVICE_COMMANDS_UNSUPPORTED.message) {
      return malformed('unsupported command outcome');
    }
    return DEVICE_COMMANDS_UNSUPPORTED;
  }
  return parse(row);
}

export function parseDeviceActionCatalog(value: unknown): DeviceActionCatalogEntry[] {
  return array(value, 'action catalog', (item) => {
    const row = object(item, 'action catalog entry');
    return {
      action: action(row.action),
      requiresParameters: boolean(row.requiresParameters, 'requiresParameters'),
    };
  });
}

export function parseDeviceCommand(value: unknown): DeviceCommand {
  const row = object(value, 'command');
  return {
    id: text(row.id, 'id'),
    imei: imei(row.imei),
    connectionId: text(row.connectionId, 'connectionId'),
    status: oneOf(row.status, 'status', COMMAND_STATES),
    sentAt: date(row.sentAt, 'sentAt'),
    answeredAt: nullable(row.answeredAt, 'answeredAt', date),
    resultCode: nullable(row.resultCode, 'resultCode', string),
    responseText: nullable(row.responseText, 'responseText', string),
    acknowledgement: nullable(row.acknowledgement, 'acknowledgement', (value) =>
      acknowledgement(value, uuid),
    ),
  };
}

export function parseDeviceCommandsPage<T = DeviceCommand>(
  value: unknown,
  parse: (value: unknown) => T,
): DeviceCommandsPage<T> {
  const row = object(value, 'command history page');
  const nextCursor = nullable(row.nextCursor, 'nextCursor', pageCursor);
  const hasMore = boolean(row.hasMore, 'hasMore');
  if (hasMore !== (nextCursor !== null)) {
    return malformed('command history page');
  }
  return {
    items: array(row.items, 'items', parse),
    cursor: nullable(row.cursor, 'cursor', pageCursor),
    nextCursor,
    hasMore,
  };
}

export function parseDeviceCommandRequest<T extends DeviceCommand>(
  value: unknown,
  parseTransport: (value: unknown) => T,
): Omit<DeviceCommandRequest, 'transportCommand'> & { transportCommand: T | null } {
  const row = object(value, 'command request');
  const display = object(row.displayParameters, 'displayParameters');
  return {
    id: uuid(row.id, 'id'),
    deviceId: uuid(row.deviceId, 'deviceId'),
    imei: imei(row.imei),
    actorId: text(row.actorId, 'actorId'),
    cancelledByActorId: nullable(row.cancelledByActorId, 'cancelledByActorId', text),
    batchId: nullable(row.batchId, 'batchId', uuid),
    batchIndex: nullable(row.batchIndex, 'batchIndex', integer),
    retryOfId: nullable(row.retryOfId, 'retryOfId', uuid),
    waitingReason: nullable(row.waitingReason, 'waitingReason', (item, field) =>
      oneOf(item, field, WAITING_REASONS),
    ),
    waitingSince: nullable(row.waitingSince, 'waitingSince', date),
    intent: string(row.intent, 'intent'),
    action: action(row.action),
    parameters: array(row.parameters, 'parameters', (item) => integer(item, 'parameter', 1, 9999)),
    parameterValues: array(row.parameterValues, 'parameterValues', (item) => {
      const parameter = object(item, 'parameter value');
      return {
        parameter: integer(parameter.parameter, 'parameter'),
        title: nullable(parameter.title, 'title', string),
        value: nullable(parameter.value, 'value', string),
        resultCode: nullable(parameter.resultCode, 'resultCode', string),
        outcome: oneOf(parameter.outcome, 'outcome', PARAMETER_OUTCOMES),
      };
    }),
    actionCode: text(row.actionCode, 'actionCode'),
    displayParameters: {
      expiresInSeconds: integer(display.expiresInSeconds, 'expiresInSeconds'),
      requestedFields: array(display.requestedFields, 'requestedFields', (item) =>
        oneOf(item, 'requestedField', DISPLAY_FIELDS),
      ),
    },
    requestedAt: date(row.requestedAt, 'requestedAt'),
    queuedAt: date(row.queuedAt, 'queuedAt'),
    submittingAt: nullable(row.submittingAt, 'submittingAt', date),
    sentAt: nullable(row.sentAt, 'sentAt', date),
    answeredAt: nullable(row.answeredAt, 'answeredAt', date),
    failedAt: nullable(row.failedAt, 'failedAt', date),
    expiredAt: nullable(row.expiredAt, 'expiredAt', date),
    cancelledAt: nullable(row.cancelledAt, 'cancelledAt', date),
    uncertainAt: nullable(row.uncertainAt, 'uncertainAt', date),
    outcomeCode: text(row.outcomeCode, 'outcomeCode'),
    reasonCode: nullable(row.reasonCode, 'reasonCode', text),
    transportCommand: nullable(row.transportCommand, 'transportCommand', parseTransport),
    status: status(row.status),
    createdAt: date(row.createdAt, 'createdAt'),
    expiresAt: date(row.expiresAt, 'expiresAt'),
    submittedAt: nullable(row.submittedAt, 'submittedAt', date),
    completedAt: nullable(row.completedAt, 'completedAt', date),
    commandId: nullable(row.commandId, 'commandId', text),
    resultCode: nullable(row.resultCode, 'resultCode', string),
    responseText: nullable(row.responseText, 'responseText', string),
    failureReason: nullable(row.failureReason, 'failureReason', string),
    faultReadVerdict: nullable(
      row.faultReadVerdict,
      'faultReadVerdict',
      parseDeviceFaultReadVerdict,
    ),
  };
}

export function parseDeviceCommandRequestsPage<T>(
  value: unknown,
  parse: (value: unknown) => T,
): DeviceCommandRequestsPage<T> {
  const row = object(value, 'command requests page');
  return {
    items: array(row.items, 'items', parse),
    total: integer(row.total, 'total'),
    offset: integer(row.offset, 'offset', 0, 2_147_483_647),
    limit: integer(row.limit, 'limit', 1, 100),
  };
}

export function parseDeviceCommandBatch<T>(
  value: unknown,
  parse: (value: unknown) => T,
): DeviceCommandBatch<T> {
  const row = object(value, 'command batch');
  return {
    id: uuid(row.id, 'id'),
    actorId: text(row.actorId, 'actorId'),
    action: action(row.action),
    createdAt: date(row.createdAt, 'createdAt'),
    stoppedAt: nullable(row.stoppedAt, 'stoppedAt', date),
    stoppedByActorId: nullable(row.stoppedByActorId, 'stoppedByActorId', text),
    counts: array(row.counts, 'counts', (item) => {
      const count = object(item, 'request count');
      return { status: status(count.status), count: integer(count.count, 'count') };
    }),
    requests: array(row.requests, 'requests', parse),
  };
}

export {
  scope as parseDeviceScope,
  actor as parseDeviceActor,
  target as parseDeviceTarget,
  pageCursor as parseDevicePageCursor,
};
