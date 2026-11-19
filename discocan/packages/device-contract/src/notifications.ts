import {
  array,
  boolean,
  date,
  imei,
  malformed,
  object,
  nullable,
  oneOf,
  queryLimit,
  text,
  uuid,
} from './parse.js';
import {
  EVIDENCE_KINDS,
  SEVERITIES,
  type DeviceEvidenceKind,
  type DeviceSeverity,
} from './status.js';

export interface DeviceNotificationsRequest {
  tenantId: string;
  branchId: string;
  deviceId: string;
  imei: string;
  since: Date;
  after: string | null;
  limit: number;
}

export interface DeviceNotificationItem {
  sourceKind: DeviceEvidenceKind;
  sourceKey: string;
  sourceId: string;
  eventId?: string | null;
  commandRequestId?: string | null;
  occurredAt: Date;
  severity: DeviceSeverity;
  wordingKey: string;
  parameters: Record<string, string | null>;
}

export interface DeviceNotificationPage {
  items: DeviceNotificationItem[];
  /** Opaque cursor to pass back as after on the next request. */
  next: string;
  hasMore: boolean;
}

export function parseDeviceNotificationsRequest(
  unit: unknown,
  query: unknown,
): DeviceNotificationsRequest {
  const row = object(query, 'notifications query', [
    'tenantId',
    'branchId',
    'deviceId',
    'since',
    'after',
    'limit',
  ]);
  return {
    tenantId: uuid(row.tenantId, 'tenantId'),
    branchId: uuid(row.branchId, 'branchId'),
    deviceId: uuid(row.deviceId, 'deviceId'),
    imei: imei(unit),
    since: date(row.since, 'since'),
    after: row.after === undefined ? null : text(row.after, 'after'),
    limit: row.limit === undefined ? 500 : queryLimit(row.limit),
  };
}

function notification(value: unknown): DeviceNotificationItem {
  const row = object(value, 'notification');
  const parameters = Object.fromEntries(
    Object.entries(object(row.parameters, 'parameters')).map(([key, value]) => {
      if (value !== null && typeof value !== 'string') {
        return malformed('notification parameter');
      }
      return [key, value];
    }),
  );
  return {
    sourceKind: oneOf(row.sourceKind, 'sourceKind', EVIDENCE_KINDS),
    sourceKey: text(row.sourceKey, 'sourceKey'),
    sourceId: text(row.sourceId, 'sourceId'),
    ...(row.eventId === undefined ? {} : { eventId: nullable(row.eventId, 'eventId', text) }),
    ...(row.commandRequestId === undefined
      ? {}
      : { commandRequestId: nullable(row.commandRequestId, 'commandRequestId', uuid) }),
    occurredAt: date(row.occurredAt, 'occurredAt'),
    severity: oneOf(row.severity, 'severity', SEVERITIES),
    wordingKey: text(row.wordingKey, 'wordingKey'),
    parameters,
  };
}

export function parseDeviceNotificationPage(
  value: unknown,
  request: DeviceNotificationsRequest,
): DeviceNotificationPage {
  const row = object(value, 'notification page');
  const next = text(row.next, 'next');
  const hasMore = boolean(row.hasMore, 'hasMore');
  const items = array(row.items, 'items', notification);
  if (
    (hasMore && next === request.after) ||
    items.some((item) => item.occurredAt < request.since)
  ) {
    return malformed('notification page');
  }
  return { items, next, hasMore };
}
