import { BadRequestException, Injectable } from '@nestjs/common';
import { commandNotification, eventNotifications } from './notification-export.mapping.js';
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

function cursor(value: unknown): NotificationExportCursor {
  if (value === undefined) {
    return { eventId: '0', commandCompletedAt: null, commandId: null };
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
  return {
    eventId: decoded.eventId,
    commandCompletedAt: decoded.commandCompletedAt,
    commandId: decoded.commandId,
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
    const [eventRows, commandRows] = await Promise.all([
      this.repository.events(imei, since, after.eventId, limit),
      this.repository.commands(scope, since, after, limit),
    ]);
    const events = eventRows.slice(0, limit);
    const commands = commandRows.slice(0, limit);
    const transportCommands = await this.repository.transportCommands(scope, commands);
    const lastCommand = commands.at(-1);
    const next: NotificationExportCursor = {
      eventId: events.at(-1)?.id ?? after.eventId,
      commandCompletedAt: lastCommand?.completedAt?.toISOString() ?? after.commandCompletedAt,
      commandId: lastCommand?.id ?? after.commandId,
    };
    return {
      items: [
        ...events.flatMap((event) => eventNotifications(event, scope)),
        ...commands.map((request) => commandNotification(request, transportCommands)),
      ],
      next: Buffer.from(JSON.stringify(next)).toString('base64url'),
      hasMore: eventRows.length > limit || commandRows.length > limit,
    };
  }
}
