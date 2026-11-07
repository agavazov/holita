import { BadRequestException, Injectable } from '@nestjs/common';
import {
  commandNotification,
  configurationNotification,
  eventNotifications,
  karmaRoutingNotification,
  snapshotNotification,
} from './notification-export.mapping.js';
import { NotificationExportRepository } from './notification-export.repository.js';
import type {
  NotificationExportCursor,
  NotificationExportPage,
  NotificationExportScope,
} from './notification-export.types.js';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function invalid(): BadRequestException {
  return new BadRequestException('Invalid notification export scope, since, cursor or limit');
}

function utcDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(new Date(value).getTime()) &&
    new Date(value).toISOString() === value
  );
}

function terminalPosition(time: unknown, id: unknown): { time: string | null; id: string | null } {
  if ((time === undefined && id === undefined) || (time === null && id === null)) {
    return { time: null, id: null };
  }
  if (!utcDate(time) || typeof id !== 'string' || !uuid.test(id)) {
    throw invalid();
  }
  return { time, id };
}

function cursor(value: unknown): NotificationExportCursor {
  if (value === undefined) {
    return {
      eventId: '0',
      karmaRoutingId: '0',
      commandCompletedAt: null,
      commandId: null,
      configurationFinishedAt: null,
      configurationId: null,
      snapshotFinishedAt: null,
      snapshotId: null,
    };
  }
  if (typeof value !== 'string') {
    throw invalid();
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('eventId' in decoded) ||
    typeof decoded.eventId !== 'string' ||
    !/^\d+$/.test(decoded.eventId) ||
    BigInt(decoded.eventId) > 9223372036854775807n ||
    ('karmaRoutingId' in decoded &&
      (typeof decoded.karmaRoutingId !== 'string' ||
        !/^\d+$/.test(decoded.karmaRoutingId) ||
        BigInt(decoded.karmaRoutingId) > 9223372036854775807n)) ||
    !('commandCompletedAt' in decoded) ||
    !('commandId' in decoded) ||
    !(
      (decoded.commandCompletedAt === null && decoded.commandId === null) ||
      (utcDate(decoded.commandCompletedAt) &&
        typeof decoded.commandId === 'string' &&
        uuid.test(decoded.commandId))
    )
  ) {
    throw invalid();
  }
  const configuration = terminalPosition(
    'configurationFinishedAt' in decoded ? decoded.configurationFinishedAt : undefined,
    'configurationId' in decoded ? decoded.configurationId : undefined,
  );
  const snapshot = terminalPosition(
    'snapshotFinishedAt' in decoded ? decoded.snapshotFinishedAt : undefined,
    'snapshotId' in decoded ? decoded.snapshotId : undefined,
  );
  return {
    eventId: decoded.eventId,
    karmaRoutingId: 'karmaRoutingId' in decoded ? String(decoded.karmaRoutingId) : '0',
    commandCompletedAt: decoded.commandCompletedAt,
    commandId: decoded.commandId,
    configurationFinishedAt: configuration.time,
    configurationId: configuration.id,
    snapshotFinishedAt: snapshot.time,
    snapshotId: snapshot.id,
  };
}

@Injectable()
export class NotificationExportService {
  constructor(private readonly repository: NotificationExportRepository) {}

  async page(
    imei: string,
    query: {
      tenantId?: unknown;
      branchId?: unknown;
      deviceId?: unknown;
      since?: unknown;
      after?: unknown;
      limit?: unknown;
    },
  ): Promise<NotificationExportPage> {
    const pageSize = query.limit === undefined ? '500' : query.limit;
    if (
      !/^\d{15}$/.test(imei) ||
      typeof query.tenantId !== 'string' ||
      !uuid.test(query.tenantId) ||
      typeof query.branchId !== 'string' ||
      !uuid.test(query.branchId) ||
      typeof query.deviceId !== 'string' ||
      !uuid.test(query.deviceId) ||
      !utcDate(query.since) ||
      typeof pageSize !== 'string' ||
      !/^\d+$/.test(pageSize) ||
      !Number.isInteger(Number(pageSize)) ||
      Number(pageSize) < 1 ||
      Number(pageSize) > 500
    ) {
      throw invalid();
    }
    const scope: NotificationExportScope = {
      tenantId: query.tenantId,
      branchId: query.branchId,
      deviceId: query.deviceId,
      imei,
    };
    const after = cursor(query.after);
    const since = new Date(query.since);
    const limit = Number(pageSize);
    const [eventRows, commandRows, karmaRoutingRows, configurationRows, snapshotRows] =
      await Promise.all([
        this.repository.events(imei, since, after.eventId, limit),
        this.repository.commands(scope, since, after, limit),
        this.repository.karmaRouting(imei, since, after.karmaRoutingId, limit),
        this.repository.configurations(scope, since, after, limit),
        this.repository.snapshots(scope, since, after, limit),
      ]);
    const events = eventRows.slice(0, limit);
    const commands = commandRows.slice(0, limit);
    const routing = karmaRoutingRows.slice(0, limit);
    const configurations = configurationRows.slice(0, limit);
    const snapshots = snapshotRows.slice(0, limit);
    const transportCommands = await this.repository.transportCommands(scope, commands);
    const lastCommand = commands.at(-1);
    const next: NotificationExportCursor = {
      eventId: events.at(-1)?.id ?? after.eventId,
      karmaRoutingId: routing.at(-1)?.id.toString() ?? after.karmaRoutingId,
      commandCompletedAt: lastCommand?.completedAt?.toISOString() ?? after.commandCompletedAt,
      commandId: lastCommand?.id ?? after.commandId,
      configurationFinishedAt:
        configurations.at(-1)?.finishedAt?.toISOString() ?? after.configurationFinishedAt,
      configurationId: configurations.at(-1)?.id ?? after.configurationId,
      snapshotFinishedAt: snapshots.at(-1)?.finishedAt?.toISOString() ?? after.snapshotFinishedAt,
      snapshotId: snapshots.at(-1)?.id ?? after.snapshotId,
    };
    return {
      items: [
        ...events.flatMap((event) => eventNotifications(event, scope)),
        ...commands.map((request) => commandNotification(request, transportCommands)),
        ...routing.map((row) => karmaRoutingNotification(row, scope)),
        ...configurations.map((row) => configurationNotification(row, scope)),
        ...snapshots.map((row) => snapshotNotification(row, scope)),
      ],
      next: Buffer.from(JSON.stringify(next)).toString('base64url'),
      hasMore:
        eventRows.length > limit ||
        commandRows.length > limit ||
        karmaRoutingRows.length > limit ||
        configurationRows.length > limit ||
        snapshotRows.length > limit,
    };
  }
}
