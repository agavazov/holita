import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, prismaDirection } from '../../database/search.js';
import type { FleetNotificationSortField } from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetNotificationCategory } from '../../generated/prisma/enums.js';
import type { FleetScope, SortDirection } from '../../validation.js';

const receiptSelection = { readAt: true } satisfies Prisma.FleetNotificationReceiptSelect;

export type NotificationRow = Prisma.FleetNotificationGetPayload<{
  include: { receipts: { select: typeof receiptSelection } };
}>;

export interface NotificationListCriteria {
  tokens: string[];
  ids: string[] | undefined;
  unread: boolean;
  categories: FleetNotificationCategory[] | undefined;
}

export interface NotificationSort {
  field: FleetNotificationSortField;
  direction: SortDirection;
}

function userReceipt(scope: FleetScope, userId: string | undefined) {
  return {
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    userId: { in: userId ? [userId] : [] },
  };
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    scope: FleetScope,
    userId: string | undefined,
    page: { offset: number; limit: number },
    criteria: NotificationListCriteria,
    sort: NotificationSort,
  ): Promise<{ items: NotificationRow[]; total: number; unreadCount: number }> {
    const receipt = userReceipt(scope, userId);
    const unread: Prisma.FleetNotificationWhereInput = { receipts: { none: receipt } };
    const where: Prisma.FleetNotificationWhereInput = {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      ...(criteria.ids ? { id: { in: criteria.ids } } : {}),
      ...(criteria.categories ? { category: { in: criteria.categories } } : {}),
      ...(criteria.unread ? unread : {}),
      AND: criteria.tokens.map((token) => ({
        OR: [{ wordingKey: literalContains(token) }, { sourceKey: literalContains(token) }],
      })),
    };
    const direction = prismaDirection(sort.direction);
    const orderBy: Prisma.FleetNotificationOrderByWithRelationInput[] = [
      sort.field === 'CREATED_AT' ? { createdAt: direction } : { occurredAt: direction },
      { id: 'desc' },
    ];
    return this.prisma.client.$transaction(
      async (transaction) => {
        const items = await transaction.fleetNotification.findMany({
          where,
          include: { receipts: { where: receipt, select: receiptSelection } },
          orderBy,
          skip: page.offset,
          take: page.limit,
        });
        const total = await transaction.fleetNotification.count({ where });
        const unreadCount = await transaction.fleetNotification.count({
          where: { tenantId: scope.tenantId, branchId: scope.branchId, ...unread },
        });
        return { items, total, unreadCount };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  markRead(
    scope: FleetScope,
    userId: string,
    id: string,
    readAt: Date,
  ): Promise<NotificationRow | null> {
    return this.prisma.client.$transaction(async (transaction) => {
      const where = { tenantId: scope.tenantId, branchId: scope.branchId, id };
      const notification = await transaction.fleetNotification.findFirst({ where });
      if (!notification) {
        return null;
      }
      await transaction.fleetNotificationReceipt.createMany({
        data: {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          notificationId: id,
          userId,
          readAt,
        },
        skipDuplicates: true,
      });
      return transaction.fleetNotification.findFirst({
        where,
        include: {
          receipts: { where: userReceipt(scope, userId), select: receiptSelection },
        },
      });
    });
  }

  markAllRead(scope: FleetScope, userId: string, readAt: Date): Promise<number> {
    return this.prisma.client.$transaction(async (transaction) => {
      const notifications = await transaction.fleetNotification.findMany({
        where: {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          receipts: { none: userReceipt(scope, userId) },
        },
        select: { id: true },
      });
      if (!notifications.length) {
        return 0;
      }
      const result = await transaction.fleetNotificationReceipt.createMany({
        data: notifications.map(({ id }) => ({
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          notificationId: id,
          userId,
          readAt,
        })),
        skipDuplicates: true,
      });
      return result.count;
    });
  }
}
