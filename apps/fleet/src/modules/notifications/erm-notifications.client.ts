import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  FleetEventSeverity,
  FleetNotificationSourceKind,
} from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';

export interface ErmNotificationItem {
  sourceKind: Exclude<FleetNotificationSourceKind, 'FLEET_ALERT'>;
  sourceKey: string;
  sourceId: string;
  occurredAt: Date;
  severity: FleetEventSeverity;
  wordingKey: string;
  parameters: Record<string, string | null>;
}

export interface ErmNotificationPage {
  items: ErmNotificationItem[];
  next: string;
  hasMore: boolean;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('ERM notification export is unavailable');
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function item(value: unknown, deviceId: string, since: Date): ErmNotificationItem {
  if (
    !record(value) ||
    (value.sourceKind !== 'DIAGNOSTIC' &&
      value.sourceKind !== 'ALARM' &&
      value.sourceKind !== 'COMMAND') ||
    typeof value.sourceKey !== 'string' ||
    !value.sourceKey ||
    typeof value.sourceId !== 'string' ||
    !value.sourceId ||
    typeof value.occurredAt !== 'string' ||
    (value.severity !== 'INFO' && value.severity !== 'WARNING' && value.severity !== 'CRITICAL') ||
    typeof value.wordingKey !== 'string' ||
    !record(value.parameters) ||
    !record(value.target) ||
    value.target.kind !== 'DEVICE' ||
    value.target.id !== deviceId ||
    value.recorded !== (value.sourceKind !== 'COMMAND')
  ) {
    throw unavailable();
  }
  const occurredAt = new Date(value.occurredAt);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt.toISOString() !== value.occurredAt ||
    occurredAt < since
  ) {
    throw unavailable();
  }
  const parameters: Record<string, string | null> = {};
  for (const [key, parameter] of Object.entries(value.parameters)) {
    if (parameter !== null && typeof parameter !== 'string') {
      throw unavailable();
    }
    parameters[key] = parameter;
  }
  return {
    sourceKind: value.sourceKind,
    sourceKey: value.sourceKey,
    sourceId: value.sourceId,
    occurredAt,
    severity: value.severity,
    wordingKey: value.wordingKey,
    parameters,
  };
}

@Injectable()
export class ErmNotificationsClient {
  async page(
    device: FleetScope & { id: string; imei: string },
    since: Date,
    after: string | null,
  ): Promise<ErmNotificationPage> {
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
      url.pathname = `/internal/notifications/units/${device.imei}`;
      url.searchParams.set('tenantId', device.tenantId);
      url.searchParams.set('branchId', device.branchId);
      url.searchParams.set('deviceId', device.id);
      url.searchParams.set('since', since.toISOString());
      url.searchParams.set('limit', '500');
      if (after !== null) {
        url.searchParams.set('after', after);
      }
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw unavailable();
      }
      const value: unknown = await response.json();
      if (
        !record(value) ||
        !Array.isArray(value.items) ||
        typeof value.next !== 'string' ||
        typeof value.hasMore !== 'boolean' ||
        (value.hasMore && value.next === after)
      ) {
        throw unavailable();
      }
      return {
        items: value.items.map((entry: unknown) => item(entry, device.id, since)),
        next: value.next,
        hasMore: value.hasMore,
      };
    } catch {
      throw unavailable();
    }
  }
}
