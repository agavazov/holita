import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { alertNotification } from './notification-projection.js';
import type { ErmNotificationPage } from './erm-notifications.client.js';

export const notificationCutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * 86_400_000);

@Injectable()
export class NotificationSourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  devices() {
    // Background registry enumeration; all source, cursor and feed operations below are scoped.
    return this.prisma.client.device.findMany({
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        imei: true,
        vehicleId: true,
        createdAt: true,
        installedAt: true,
      },
    });
  }

  async cutoff(scope: FleetScope, now: Date): Promise<Date> {
    const settings = await this.prisma.client.fleetSettings.findUnique({
      where: { tenantId_branchId: scope },
      select: { notificationRetentionDays: true },
    });
    return notificationCutoff(now, settings?.notificationRetentionDays ?? 7);
  }

  async cursor(scope: FleetScope, sourceKey: string, since: Date) {
    return this.prisma.client.fleetNotificationCursor.upsert({
      where: { tenantId_branchId_sourceKey: { ...scope, sourceKey } },
      create: { ...scope, sourceKey, since },
      update: {},
    });
  }

  async importPage(
    device: Awaited<ReturnType<NotificationSourcesRepository['devices']>>[number],
    page: ErmNotificationPage,
    createdAt: Date,
  ): Promise<void> {
    const scope = { tenantId: device.tenantId, branchId: device.branchId };
    await this.prisma.client.$transaction(async (transaction) => {
      const data: Prisma.FleetNotificationCreateManyInput[] = page.items.map((item) => ({
        ...scope,
        sourceKind: item.sourceKind,
        sourceKey: item.sourceKey,
        category: item.sourceKind === 'COMMAND' ? 'COMMAND' : 'DEVICE',
        severity: item.severity,
        occurredAt: item.occurredAt,
        createdAt,
        wordingKey: item.wordingKey,
        parameters: item.parameters,
        deviceId: device.id,
        vehicleId:
          item.occurredAt >= (device.installedAt ?? device.createdAt) ? device.vehicleId : null,
        ermEventId: item.sourceKind === 'COMMAND' ? null : item.sourceId,
        commandRequestId: item.sourceKind === 'COMMAND' ? item.sourceId : null,
      }));
      if (data.length) {
        await transaction.fleetNotification.createMany({ data, skipDuplicates: true });
      }
      await transaction.fleetNotificationCursor.update({
        where: { tenantId_branchId_sourceKey: { ...scope, sourceKey: `erm:${device.id}` } },
        data: { position: page.next },
      });
    });
  }

  async projectAlerts(now: Date): Promise<void> {
    // Enumerate Branches with alert sources, including fleets with no current Device registration.
    const scopes = await this.prisma.client.fleetEvent.groupBy({
      by: ['tenantId', 'branchId'],
      where: { alertStatus: { not: null } },
    });
    for (const scope of scopes) {
      const cutoff = await this.cutoff(scope, now);
      const cursor = await this.cursor(scope, 'fleet-alerts', cutoff);
      const since = cursor.since > cutoff ? cursor.since : cutoff;
      const events = await this.prisma.client.fleetEvent.findMany({
        where: {
          ...scope,
          alertStatus: { not: null },
          OR: [
            { occurredAt: { gte: since } },
            { acknowledgedAt: { gte: since } },
            { resolvedAt: { gte: since } },
          ],
        },
      });
      const data: Prisma.FleetNotificationCreateManyInput[] = [];
      for (const event of events) {
        if (event.occurredAt >= since) {
          data.push(alertNotification(event, 'OPEN', event.occurredAt, now));
        }
        if (event.acknowledgedAt !== null && event.acknowledgedAt >= since) {
          data.push(alertNotification(event, 'ACKNOWLEDGED', event.acknowledgedAt, now));
        }
        if (event.resolvedAt !== null && event.resolvedAt >= since) {
          data.push(alertNotification(event, 'RESOLVED', event.resolvedAt, now));
        }
      }
      if (data.length) {
        await this.prisma.client.fleetNotification.createMany({ data, skipDuplicates: true });
      }
    }
  }

  async cleanup(now: Date): Promise<number> {
    const scopes = await this.prisma.client.fleetNotification.groupBy({
      by: ['tenantId', 'branchId'],
    });
    let removed = 0;
    for (const scope of scopes) {
      const cutoff = await this.cutoff(scope, now);
      const result = await this.prisma.client.fleetNotification.deleteMany({
        where: { ...scope, createdAt: { lt: cutoff } },
      });
      removed += result.count;
    }
    return removed;
  }
}
