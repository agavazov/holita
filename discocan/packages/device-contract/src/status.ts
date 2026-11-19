import {
  array,
  boolean,
  date,
  imei,
  imeis,
  integer,
  malformed,
  nullable,
  object,
  oneOf,
  text,
  uuid,
} from './parse.js';
import {
  DIAGNOSTIC_KINDS,
  DIAGNOSTIC_STATUSES,
  type DeviceDiagnosticKind,
  type DeviceDiagnosticStatus,
} from './reports.js';

export const EVIDENCE_KINDS = ['DIAGNOSTIC', 'ALARM', 'COMMAND'] as const;
export const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
const PROBLEM_STATES = ['RECORDED', 'FAILED', 'UNCERTAIN', 'EXPIRED'] as const;

export type DeviceEvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type DeviceSeverity = (typeof SEVERITIES)[number];

export interface DeviceHealth {
  status: 'ok';
  service: string;
}

export interface DeviceLiveState {
  imei: string;
  connected: boolean;
  lastReportAt: Date | null;
  expectedIntervalSeconds: number;
  reporting: boolean;
}

export interface DeviceLiveRequest {
  imeis: string[];
}

export interface DeviceLiveSnapshot {
  asOf: Date;
  devices: DeviceLiveState[];
}

export interface DeviceProblemRequest {
  tenantId: string;
  branchId: string;
  imeis: string[];
  from: Date;
  to: Date;
  offset: number;
  limit: number;
}

export interface DeviceProblemEvidence {
  sourceKind: DeviceEvidenceKind;
  sourceId: string;
  imei: string;
  deviceId: string | null;
  occurredAt: Date;
  severity: DeviceSeverity;
  state: (typeof PROBLEM_STATES)[number];
  code: string;
  details: string | null;
  eventTime: Date | null;
  eventId: string | null;
  diagnostics: {
    kind: DeviceDiagnosticKind;
    troubleCode: string | null;
    report?: number;
    status: DeviceDiagnosticStatus | null;
  }[];
}

export interface DeviceProblemPage {
  asOf: Date;
  totalCount: number;
  hasMore: boolean;
  items: DeviceProblemEvidence[];
  counts: { sourceKind: DeviceEvidenceKind; severity: DeviceSeverity; count: number }[];
}

export function parseDeviceHealth(value: unknown): DeviceHealth {
  const row = object(value, 'health');
  return { status: oneOf(row.status, 'status', ['ok']), service: text(row.service, 'service') };
}

export function parseDeviceLiveRequest(value: unknown): DeviceLiveRequest {
  const row = object(value, 'live request', ['imeis']);
  return { imeis: imeis(row.imeis, 1) };
}

export function parseDeviceLiveSnapshot(
  value: unknown,
  request: DeviceLiveRequest,
): DeviceLiveSnapshot {
  const row = object(value, 'live snapshot');
  const devices = array(row.devices, 'devices', (value) => {
    const entry = object(value, 'live state');
    return {
      imei: imei(entry.imei),
      connected: boolean(entry.connected, 'connected'),
      lastReportAt: nullable(entry.lastReportAt, 'lastReportAt', date),
      expectedIntervalSeconds: integer(entry.expectedIntervalSeconds, 'expectedIntervalSeconds'),
      reporting: boolean(entry.reporting, 'reporting'),
    };
  });
  if (
    new Set(devices.map((entry) => entry.imei)).size !== devices.length ||
    devices.some((entry) => !request.imeis.includes(entry.imei))
  ) {
    return malformed('live device scope');
  }
  return { asOf: date(row.asOf, 'asOf'), devices };
}

export function parseDeviceProblemRequest(value: unknown): DeviceProblemRequest {
  const row = object(value, 'problem request', [
    'tenantId',
    'branchId',
    'imeis',
    'from',
    'to',
    'offset',
    'limit',
  ]);
  const from = date(row.from, 'from');
  const to = date(row.to, 'to');
  if (from > to) {
    return malformed('problem period');
  }
  return {
    tenantId: uuid(row.tenantId, 'tenantId'),
    branchId: uuid(row.branchId, 'branchId'),
    imeis: imeis(row.imeis, 0),
    from,
    to,
    offset: row.offset === undefined ? 0 : integer(row.offset, 'offset'),
    limit: row.limit === undefined ? 500 : integer(row.limit, 'limit', 1, 500),
  };
}

function evidence(value: unknown): DeviceProblemEvidence {
  const row = object(value, 'problem');
  return {
    sourceKind: oneOf(row.sourceKind, 'sourceKind', EVIDENCE_KINDS),
    sourceId: text(row.sourceId, 'sourceId'),
    imei: imei(row.imei),
    deviceId: nullable(row.deviceId, 'deviceId', uuid),
    occurredAt: date(row.occurredAt, 'occurredAt'),
    severity: oneOf(row.severity, 'severity', SEVERITIES),
    state: oneOf(row.state, 'state', PROBLEM_STATES),
    code: text(row.code, 'code'),
    details: nullable(row.details, 'details', text),
    eventTime: nullable(row.eventTime, 'eventTime', date),
    eventId: nullable(row.eventId, 'eventId', text),
    diagnostics: array(row.diagnostics, 'diagnostics', (value) => {
      const diagnostic = object(value, 'problem diagnostic');
      return {
        kind: oneOf(diagnostic.kind, 'kind', DIAGNOSTIC_KINDS),
        troubleCode: nullable(diagnostic.troubleCode, 'troubleCode', text),
        ...(diagnostic.report === undefined
          ? {}
          : { report: integer(diagnostic.report, 'report') }),
        status: nullable(diagnostic.status, 'status', (status, field) =>
          oneOf(status, field, DIAGNOSTIC_STATUSES),
        ),
      };
    }),
  };
}

export function parseDeviceProblemPage(
  value: unknown,
  request: DeviceProblemRequest,
): DeviceProblemPage {
  const row = object(value, 'problem page');
  const items = array(row.items, 'items', evidence);
  const totalCount = integer(row.totalCount, 'totalCount');
  const hasMore = boolean(row.hasMore, 'hasMore');
  if (
    items.length > request.limit ||
    items.length > totalCount ||
    hasMore !== request.offset + items.length < totalCount ||
    (hasMore && items.length === 0) ||
    items.some((item) => !request.imeis.includes(item.imei))
  ) {
    return malformed('problem page');
  }
  return {
    asOf: date(row.asOf, 'asOf'),
    totalCount,
    hasMore,
    items,
    counts: array(row.counts, 'counts', (value) => {
      const count = object(value, 'problem count');
      return {
        sourceKind: oneOf(count.sourceKind, 'sourceKind', EVIDENCE_KINDS),
        severity: oneOf(count.severity, 'severity', SEVERITIES),
        count: integer(count.count, 'count'),
      };
    }),
  };
}
