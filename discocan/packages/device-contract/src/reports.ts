import {
  array,
  boolean,
  date,
  decimalId,
  imei,
  integer,
  malformed,
  nullable,
  number,
  object,
  oneOf,
  queryLimit,
  text,
} from './parse.js';

export const DIAGNOSTIC_KINDS = [
  'DIAGNOSTIC_TROUBLE_CODE',
  'CAN_ERROR',
  'CAN_DISCONNECTED',
] as const;
export const DIAGNOSTIC_STATUSES = ['ADDED', 'DELETED'] as const;

export type DeviceDiagnosticKind = (typeof DIAGNOSTIC_KINDS)[number];
export type DeviceDiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];

export type DeviceDiagnostic = {
  report: number;
  index: number;
  details?: string;
} & (
  | {
      kind: 'DIAGNOSTIC_TROUBLE_CODE';
      code: string;
      spn?: number;
      fmi?: number;
      status: DeviceDiagnosticStatus;
    }
  | { kind: 'CAN_ERROR' | 'CAN_DISCONNECTED' }
);

/** The Simple eData catalog defines Discocan's measurement vocabulary for every device type. */
export interface DeviceMeasurement {
  parameterId: number;
  parameterType: number;
  valueSize: number;
  valueHex: string;
  freezeFrame: boolean;
}

export interface DeviceReport {
  id: bigint;
  alarmCode?: string | null;
  recordedAt: Date | null;
  receivedAt: Date;
  latitude: number | null;
  longitude: number | null;
  speedKph: number | null;
  headingDeg: number | null;
  ignition: boolean | null;
  engineOn: boolean | null;
  odometerKm: number | null;
  externalVoltage: number | null;
  backupBatteryVoltage: number | null;
  diagnostics: DeviceDiagnostic[];
  measurements: DeviceMeasurement[];
}

export interface DeviceReportsRequest {
  imei: string;
  after: bigint;
  limit: number;
}

export interface DeviceReportPage {
  reports: DeviceReport[];
  next: bigint;
}

export function parseDeviceReportsRequest(unit: unknown, query: unknown): DeviceReportsRequest {
  const row = object(query, 'reports query', ['after', 'limit']);
  return { imei: imei(unit), after: decimalId(row.after, 'after'), limit: queryLimit(row.limit) };
}

function diagnostic(value: unknown): DeviceDiagnostic {
  const row = object(value, 'diagnostic');
  const kind = oneOf(row.kind, 'kind', DIAGNOSTIC_KINDS);
  const evidence = {
    report: integer(row.report, 'report'),
    index: integer(row.index, 'index'),
    ...(row.details === undefined ? {} : { details: text(row.details, 'details') }),
  };
  if (kind !== 'DIAGNOSTIC_TROUBLE_CODE') {
    return { ...evidence, kind };
  }
  return {
    ...evidence,
    kind,
    code: text(row.code, 'code'),
    status: oneOf(row.status, 'status', DIAGNOSTIC_STATUSES),
    ...(row.spn === undefined ? {} : { spn: integer(row.spn, 'spn') }),
    ...(row.fmi === undefined ? {} : { fmi: integer(row.fmi, 'fmi') }),
  };
}

export function parseDeviceMeasurement(value: unknown): DeviceMeasurement {
  const row = object(value, 'measurement');
  const valueSize = integer(row.valueSize, 'valueSize', 1, 4);
  const valueHex = text(row.valueHex, 'valueHex', /^[0-9a-f]+$/i);
  if (valueSize === 3 || valueHex.length !== 2 * valueSize) {
    return malformed('measurement size');
  }
  return {
    parameterId: integer(row.parameterId, 'parameterId', 0, 65535),
    parameterType: integer(row.parameterType, 'parameterType', 0, 255),
    valueSize,
    valueHex,
    freezeFrame: boolean(row.freezeFrame, 'freezeFrame'),
  };
}

function report(value: unknown): DeviceReport {
  const row = object(value, 'report');
  return {
    id: decimalId(row.id, 'id'),
    ...(row.alarmCode === undefined
      ? {}
      : { alarmCode: nullable(row.alarmCode, 'alarmCode', text) }),
    recordedAt: nullable(row.recordedAt, 'recordedAt', date),
    receivedAt: date(row.receivedAt, 'receivedAt'),
    latitude: nullable(row.latitude, 'latitude', number),
    longitude: nullable(row.longitude, 'longitude', number),
    speedKph: nullable(row.speedKph, 'speedKph', number),
    headingDeg: nullable(row.headingDeg, 'headingDeg', number),
    ignition: nullable(row.ignition, 'ignition', boolean),
    engineOn: nullable(row.engineOn, 'engineOn', boolean),
    odometerKm: nullable(row.odometerKm, 'odometerKm', number),
    externalVoltage: nullable(row.externalVoltage, 'externalVoltage', number),
    backupBatteryVoltage: nullable(row.backupBatteryVoltage, 'backupBatteryVoltage', number),
    diagnostics: array(row.diagnostics, 'diagnostics', diagnostic),
    measurements: array(row.measurements, 'measurements', parseDeviceMeasurement),
  };
}

export function parseDeviceReportPage(
  value: unknown,
  request: DeviceReportsRequest,
): DeviceReportPage {
  const row = object(value, 'report page');
  const reports = array(row.reports, 'reports', report);
  let previous = request.after;
  for (const entry of reports) {
    if (entry.id <= previous) {
      return malformed('report order');
    }
    previous = entry.id;
  }
  const next = decimalId(row.next, 'next');
  if (reports.length > request.limit || next !== previous) {
    return malformed('report page');
  }
  return { reports, next };
}
