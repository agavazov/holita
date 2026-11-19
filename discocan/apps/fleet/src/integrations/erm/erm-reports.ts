import type { DeviceDiagnostic, DeviceReport, DeviceReportPage } from '@discocan/device-contract';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isErmRecord, requestErmInternal } from './erm-api.js';

type ErmTelemetryEdata =
  | {
      /** 405 periodic values; 415 values captured when a fault arrived (freeze frame). */
      report: '405' | '415';
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
    }
  | {
      report: '413' | '418';
      faults: { code: string; status: 'ADDED' | 'DELETED' }[];
    }
  | {
      report: '417';
      noCanMessages: true;
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

interface ErmTelemetryPage {
  events: ErmTelemetryEvent[];
  next: bigint;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('ERM telemetry is unavailable');
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
  if (!isErmRecord(value)) {
    throw unavailable();
  }
  if (value.report === '405' || value.report === '415') {
    if (!Array.isArray(value.measurements)) {
      throw unavailable();
    }
    return {
      report: value.report,
      measurements: value.measurements.map((measurement: unknown) => {
        if (
          !isErmRecord(measurement) ||
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
          !isErmRecord(fault) ||
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
  if (value.report === '413' || value.report === '418') {
    if (!Array.isArray(value.faults)) {
      throw unavailable();
    }
    return {
      report: value.report,
      faults: value.faults.map((fault: unknown) => {
        if (
          !isErmRecord(fault) ||
          typeof fault.code !== 'string' ||
          fault.code.length !== 5 ||
          Buffer.byteLength(fault.code, 'utf8') !== 5 ||
          (fault.status !== 'ADDED' && fault.status !== 'DELETED')
        ) {
          throw unavailable();
        }
        return { code: fault.code, status: fault.status };
      }),
    };
  }
  if (value.report === '417') {
    if (value.noCanMessages !== true) {
      throw unavailable();
    }
    return { report: value.report, noCanMessages: true };
  }
  return null;
}

function telemetryEvent(value: unknown): ErmTelemetryEvent {
  if (
    !isErmRecord(value) ||
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
  if (!isErmRecord(value) || !Array.isArray(value.events) || value.events.length > 500) {
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

function diagnostics(edata: ErmTelemetryEvent['edata']): DeviceDiagnostic[] {
  switch (edata?.report) {
    case '419':
      return edata.faults.map(({ spn, fmi, status }, index) => ({
        kind: 'DIAGNOSTIC_TROUBLE_CODE',
        report: 419,
        index,
        code: `SPN ${String(spn)} FMI ${String(fmi)}`,
        spn,
        fmi,
        status,
        details:
          status === 'ADDED'
            ? 'eData 419: the fault logger added this fault.'
            : 'eData 419: the fault logger deleted this fault; this does not prove a repair.',
      }));
    case '413':
    case '418':
      return edata.faults.map(({ code, status }, index) => ({
        kind: 'DIAGNOSTIC_TROUBLE_CODE',
        report: Number(edata.report),
        index,
        code,
        status,
        details:
          status === 'ADDED'
            ? `eData ${edata.report}: the fault logger added this fault.`
            : `eData ${edata.report}: the fault logger deleted this fault; this does not prove a repair.`,
      }));
    case '417':
      return [
        {
          kind: 'CAN_DISCONNECTED',
          report: 417,
          index: 0,
          details: 'eData 417 reported no CAN messages for 500 ms while ignition was on.',
        },
      ];
    case '411':
      return edata.canError
        ? [
            {
              kind: 'CAN_ERROR',
              report: 411,
              index: 0,
              details: `eData 411 reported the CAN error flag; CAN=${String(Number(edata.can))}, J1708=${String(Number(edata.j1708))}, OBD=${String(Number(edata.obd))}, OBD mask=${String(edata.obdMask)}, ignition=${String(edata.ignition)}.`,
            },
          ]
        : [];
    default:
      return [];
  }
}

function report(event: ErmTelemetryEvent): DeviceReport {
  const edata = event.edata;
  return {
    id: event.id,
    alarmCode: event.eventId,
    recordedAt: event.eventTime,
    receivedAt: event.receivedAt,
    latitude: event.latitude,
    longitude: event.longitude,
    speedKph: event.speedKmh,
    headingDeg: event.heading,
    ignition: event.ignitionOn,
    engineOn: event.engineOn,
    odometerKm: event.odometerKm,
    externalVoltage: event.mainVoltage,
    backupBatteryVoltage: event.backupVoltage,
    diagnostics: diagnostics(edata),
    measurements:
      edata?.report === '405' || edata?.report === '415'
        ? edata.measurements.map((measurement) => ({
            ...measurement,
            freezeFrame: edata.report === '415',
          }))
        : [],
  };
}

@Injectable()
export class ErmReports {
  async reports(imei: string, after: bigint): Promise<DeviceReportPage> {
    try {
      const payload = await requestErmInternal(`/internal/telemetry/units/${imei}/events`, {
        query: new URLSearchParams({ after: after.toString(), limit: '500' }),
      });
      const page = telemetryPage(payload, after);
      return { reports: page.events.map(report), next: page.next };
    } catch {
      throw unavailable();
    }
  }
}
