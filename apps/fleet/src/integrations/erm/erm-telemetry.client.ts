import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type ErmTelemetryEdata =
  | {
      report: '405';
      measurements: {
        parameterId: number;
        parameterType: number;
        valueSize: number;
        valueHex: string;
      }[];
    }
  | {
      report: '411';
      can: boolean;
      j1708: boolean;
      obd: boolean;
      obdMask: number;
      canError: boolean;
      ignition: 0 | 1 | 2;
    }
  | {
      report: '419';
      faults: { spn: number; fmi: number; status: 'ADDED' | 'DELETED' }[];
    };

export interface ErmTelemetryEvent {
  id: bigint;
  eventId: string | null;
  eventTime: Date | null;
  receivedAt: Date;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  heading: number | null;
  odometerKm: number | null;
  mainVoltage: number | null;
  backupVoltage: number | null;
  engineOn: boolean | null;
  ignitionOn: boolean | null;
  edata: ErmTelemetryEdata | null;
}

export interface ErmTelemetryPage {
  events: ErmTelemetryEvent[];
  next: bigint;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('ERM telemetry is unavailable');
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decimalId(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw unavailable();
  }
  return BigInt(value);
}

function utcDate(value: unknown, milliseconds: boolean): Date {
  if (
    typeof value !== 'string' ||
    !(
      milliseconds
        ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
    ).test(value)
  ) {
    throw unavailable();
  }
  const date = new Date(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== canonical) {
    throw unavailable();
  }
  return date;
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function telemetryEdata(value: unknown): ErmTelemetryEdata | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!record(value)) {
    throw unavailable();
  }
  if (value.report === '405') {
    if (!Array.isArray(value.measurements)) {
      throw unavailable();
    }
    return {
      report: value.report,
      measurements: value.measurements.map((measurement: unknown) => {
        if (
          !record(measurement) ||
          !integer(measurement.parameterId) ||
          measurement.parameterId < 0 ||
          measurement.parameterId > 65535 ||
          !integer(measurement.parameterType) ||
          measurement.parameterType < 0 ||
          measurement.parameterType > 255 ||
          !integer(measurement.valueSize) ||
          ![1, 2, 4].includes(measurement.valueSize) ||
          typeof measurement.valueHex !== 'string' ||
          measurement.valueHex.length !== 2 * measurement.valueSize ||
          !/^[0-9a-f]+$/i.test(measurement.valueHex)
        ) {
          throw unavailable();
        }
        return {
          parameterId: measurement.parameterId,
          parameterType: measurement.parameterType,
          valueSize: measurement.valueSize,
          valueHex: measurement.valueHex,
        };
      }),
    };
  }
  if (value.report === '411') {
    if (
      typeof value.can !== 'boolean' ||
      typeof value.j1708 !== 'boolean' ||
      typeof value.obd !== 'boolean' ||
      !integer(value.obdMask) ||
      typeof value.canError !== 'boolean' ||
      (value.ignition !== 0 && value.ignition !== 1 && value.ignition !== 2)
    ) {
      throw unavailable();
    }
    return {
      report: value.report,
      can: value.can,
      j1708: value.j1708,
      obd: value.obd,
      obdMask: value.obdMask,
      canError: value.canError,
      ignition: value.ignition,
    };
  }
  if (value.report === '419') {
    if (!Array.isArray(value.faults)) {
      throw unavailable();
    }
    return {
      report: value.report,
      faults: value.faults.map((fault: unknown) => {
        if (
          !record(fault) ||
          !integer(fault.spn) ||
          !integer(fault.fmi) ||
          (fault.status !== 'ADDED' && fault.status !== 'DELETED')
        ) {
          throw unavailable();
        }
        return { spn: fault.spn, fmi: fault.fmi, status: fault.status };
      }),
    };
  }
  return null;
}

function telemetryEvent(value: unknown): ErmTelemetryEvent {
  if (
    !record(value) ||
    (value.eventId !== null && typeof value.eventId !== 'string') ||
    !nullableNumber(value.latitude) ||
    !nullableNumber(value.longitude) ||
    !nullableNumber(value.speedKmh) ||
    !nullableNumber(value.heading) ||
    !nullableNumber(value.odometerKm) ||
    !nullableNumber(value.mainVoltage) ||
    !nullableNumber(value.backupVoltage) ||
    (value.engineOn !== null && typeof value.engineOn !== 'boolean') ||
    (value.ignitionOn !== undefined &&
      value.ignitionOn !== null &&
      typeof value.ignitionOn !== 'boolean')
  ) {
    throw unavailable();
  }
  return {
    id: decimalId(value.id),
    eventId: value.eventId,
    eventTime: value.eventTime === null ? null : utcDate(value.eventTime, true),
    receivedAt: utcDate(value.receivedAt, false),
    latitude: value.latitude,
    longitude: value.longitude,
    speedKmh: value.speedKmh,
    heading: value.heading,
    odometerKm: value.odometerKm,
    mainVoltage: value.mainVoltage,
    backupVoltage: value.backupVoltage,
    engineOn: value.engineOn,
    ignitionOn: value.ignitionOn ?? null,
    edata: telemetryEdata(value.edata),
  };
}

function telemetryPage(value: unknown, after: bigint): ErmTelemetryPage {
  if (!record(value) || !Array.isArray(value.events) || value.events.length > 500) {
    throw unavailable();
  }
  const events = value.events.map(telemetryEvent);
  let previous = after;
  for (const event of events) {
    if (event.id <= previous) {
      throw unavailable();
    }
    previous = event.id;
  }
  const next = decimalId(value.next);
  if (next !== previous) {
    throw unavailable();
  }
  return { events, next };
}

@Injectable()
export class ErmTelemetryClient {
  async page(imei: string, after: bigint): Promise<ErmTelemetryPage> {
    const token = process.env.ERM_TELEMETRY_TOKEN;
    if (!token || token.length < 32) {
      throw unavailable();
    }
    try {
      const url = new URL(process.env.ERM_TELEMETRY_URL ?? 'http://127.0.0.1:11017');
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      ) {
        throw unavailable();
      }
      url.pathname = `/internal/telemetry/units/${imei}/events`;
      url.searchParams.set('after', after.toString());
      url.searchParams.set('limit', '500');
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw unavailable();
      }
      const payload: unknown = await response.json();
      return telemetryPage(payload, after);
    } catch {
      throw unavailable();
    }
  }
}
