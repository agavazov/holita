import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetNotification,
  FleetNotificationPage,
  FleetNotificationParameters,
  FleetNotificationReadState,
  FleetNotificationSortField,
  QueryNotificationsArgs,
} from '../../generated/graphql/types.js';
import { FleetNotificationCategory } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumFilter,
  enumValue,
  ids,
  pagination,
  requireScope,
  searchTokens,
  sortDirection,
  sortField,
  uuid,
} from '../../validation.js';
import { NotificationsRepository, type NotificationRow } from './notifications.repository.js';

const CATEGORIES = Object.values(FleetNotificationCategory);
const READ_STATES: readonly FleetNotificationReadState[] = ['ALL', 'UNREAD'];
const SORT_FIELDS: readonly FleetNotificationSortField[] = ['OCCURRED_AT', 'CREATED_AT'];

function wordingParameters(value: Prisma.JsonValue): FleetNotificationParameters {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Notification wording parameters must be an object.');
  }
  const stringValue = (key: string): string | null => {
    const parameter = value[key];
    if (parameter === null || parameter === undefined) {
      return null;
    }
    if (typeof parameter !== 'string') {
      throw new Error(`Invalid notification wording parameter: ${key}.`);
    }
    return parameter;
  };
  const alertStatus = stringValue('alertStatus');
  if (
    alertStatus !== null &&
    alertStatus !== 'OPEN' &&
    alertStatus !== 'ACKNOWLEDGED' &&
    alertStatus !== 'RESOLVED'
  ) {
    throw new Error('Invalid notification alert status.');
  }
  return {
    eventKind: stringValue('eventKind'),
    alertStatus,
    transition: stringValue('transition'),
    troubleCode: stringValue('troubleCode'),
    diagnosticStatus: stringValue('diagnosticStatus'),
    alarmCode: stringValue('alarmCode'),
    commandKind: stringValue('commandKind'),
    commandStatus: stringValue('commandStatus'),
    reasonCode: stringValue('reasonCode'),
  };
}

function notification(row: NotificationRow): FleetNotification {
  return {
    id: row.id,
    branchId: row.branchId,
    sourceKind: row.sourceKind,
    sourceKey: row.sourceKey,
    category: row.category,
    severity: row.severity,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    wordingKey: row.wordingKey,
    parameters: wordingParameters(row.parameters),
    vehicleId: row.vehicleId,
    deviceId: row.deviceId,
    alertId: row.alertId,
    ermEventId: row.ermEventId,
    commandRequestId: row.commandRequestId,
    readAt: row.receipts[0]?.readAt ?? null,
  };
}

function requireUser(context: RequestContext): string {
  if (!context.userId) {
    throw new BadRequestException('Sign in with a user account to mark notifications as read.');
  }
  return context.userId;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly clock: FleetClock,
  ) {}

  async list(
    context: RequestContext,
    args: QueryNotificationsArgs,
  ): Promise<FleetNotificationPage> {
    const scope = requireScope(context);
    const page = pagination(args);
    const tokens = searchTokens(args.search);
    const requestedIds = args.ids == null ? undefined : ids(args.ids, 'ids');
    const readState =
      args.filter?.readState == null
        ? 'ALL'
        : enumValue(args.filter.readState, READ_STATES, 'filter');
    const categories = enumFilter(args.filter?.categories, CATEGORIES, 'categories');
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'OCCURRED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const result = await this.notifications.list(
      scope,
      context.userId,
      page,
      { tokens, ids: requestedIds, unread: readState === 'UNREAD', categories },
      sort,
    );
    return { ...page, ...result, items: result.items.map(notification) };
  }

  async markRead(context: RequestContext, id: string): Promise<FleetNotification> {
    const scope = requireScope(context);
    const userId = requireUser(context);
    const row = await this.notifications.markRead(scope, userId, uuid(id, 'id'), this.clock.now());
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    return notification(row);
  }

  markAllRead(context: RequestContext): Promise<number> {
    const scope = requireScope(context);
    return this.notifications.markAllRead(scope, requireUser(context), this.clock.now());
  }
}
