import { Injectable, ServiceUnavailableException } from '@nestjs/common';

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
    (value.engineOn !== null && typeof value.engineOn !== 'boolean')
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
