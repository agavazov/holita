import type { DeviceNotificationPage, DeviceNotificationsRequest } from '@discocan/device-contract';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  FleetEventSeverity,
  FleetNotificationSourceKind,
} from '../../generated/prisma/enums.js';
import { isErmRecord, requestErmInternal } from './erm-api.js';

export interface ErmNotificationItem {
  sourceKind: Exclude<FleetNotificationSourceKind, 'FLEET_ALERT'>;
  sourceKey: string;
  sourceId: string;
  occurredAt: Date;
  severity: FleetEventSeverity;
  wordingKey: string;
  parameters: Record<string, string | null>;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('ERM notification export is unavailable');
}

function item(value: unknown, deviceId: string, since: Date): ErmNotificationItem {
  if (
    !isErmRecord(value) ||
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
    !isErmRecord(value.parameters) ||
    !isErmRecord(value.target) ||
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
export class ErmNotifications {
  async notifications({
    deviceId,
    imei,
    since,
    after,
    tenantId,
    branchId,
  }: DeviceNotificationsRequest): Promise<DeviceNotificationPage> {
    try {
      const query = new URLSearchParams({
        tenantId,
        branchId,
        deviceId,
        since: since.toISOString(),
        limit: '500',
      });
      if (after !== null) {
        query.set('after', after);
      }
      const value = await requestErmInternal(`/internal/notifications/units/${imei}`, { query });
      if (
        !isErmRecord(value) ||
        !Array.isArray(value.items) ||
        typeof value.next !== 'string' ||
        typeof value.hasMore !== 'boolean' ||
        (value.hasMore && value.next === after)
      ) {
        throw unavailable();
      }
      return {
        items: value.items.map((entry: unknown) => {
          const notification = item(entry, deviceId, since);
          const { sourceKind, sourceId } = notification;
          return {
            ...notification,
            eventId:
              sourceKind === 'COMMAND' || sourceId.startsWith('karma-routing:') ? null : sourceId,
            commandRequestId: sourceKind === 'COMMAND' && !sourceId.includes(':') ? sourceId : null,
          };
        }),
        next: value.next,
        hasMore: value.hasMore,
      };
    } catch {
      throw unavailable();
    }
  }
}
