import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { literalContains, nullsLast, prismaDirection } from '../../database/search.js';
import { Prisma, type KarmaMonitoringTruck } from '../../generated/prisma/client.js';
import type { UpdateFleetKarmaMonitoringSettingsInput } from '../../generated/graphql/types.js';
import type { FleetScope, SortDirection } from '../../validation.js';

export const monitoringDefaults: UpdateFleetKarmaMonitoringSettingsInput = {
  enabled: false,
  statusPollSeconds: 60,
  offlineAfterMinutes: 15,
  faultHistoryPollMinutes: 60,
  faultCommandEnabled: true,
  faultCommandMinutes: 60,
  retentionDays: 10,
};

export type MonitoringEventData = Omit<
  Prisma.KarmaMonitoringEventUncheckedCreateInput,
  'tenantId' | 'branchId'
>;
export type MonitoringTruckData = Pick<
  KarmaMonitoringTruck,
  'karmaCarId' | 'karmaDeviceId' | 'displayName' | 'lastDataAt'
> & { ignitionOffAt?: Date | null };

@Injectable()
export class KarmaMonitoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  settings(scope: FleetScope) {
    return this.prisma.client.karmaMonitoringSettings.findUnique({
      where: { tenantId_branchId: scope },
    });
  }

  saveSettings(scope: FleetScope, data: UpdateFleetKarmaMonitoringSettingsInput) {
    return this.prisma.client.karmaMonitoringSettings.upsert({
      where: { tenantId_branchId: scope },
      create: { ...scope, ...data },
      update: data,
    });
  }

  /** Only the background worker discovers stored scopes. Every subsequent access uses both IDs. */
  branches() {
    return this.prisma.client.karmaMonitoringSettings.findMany();
  }

  markSettings(
    scope: FleetScope,
    data: Pick<
      Prisma.KarmaMonitoringSettingsUpdateManyMutationInput,
      'lastStatusPollAt' | 'lastRetentionAt'
    >,
  ) {
    return this.prisma.client.karmaMonitoringSettings.updateMany({ where: scope, data });
  }

  trucks(scope: FleetScope) {
    return this.prisma.client.karmaMonitoringTruck.findMany({
      where: scope,
      orderBy: { karmaCarId: 'asc' },
    });
  }

  routingDevices(scope: FleetScope, imeis: string[]) {
    return this.prisma.client.device.findMany({
      where: { ...scope, imei: { in: imeis } },
      select: {
        imei: true,
        vehicleId: true,
        ermCursor: { where: scope, select: { lastReceivedAt: true } },
      },
    });
  }

  async saveRouting(
    scope: FleetScope,
    karmaCarId: string,
    data: Pick<KarmaMonitoringTruck, 'routing' | 'routingAheadPolls' | 'routingAheadSince'>,
    event: Omit<Prisma.FleetEventCreateManyInput, 'tenantId' | 'branchId'> | null,
    now: Date,
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      const previous = await tx.karmaMonitoringTruck.findUnique({
        where: { tenantId_branchId_karmaCarId: { ...scope, karmaCarId } },
      });
      if (previous === null) {
        return;
      }
      const enteringBackup = data.routing === 'KARMA_BACKUP' && previous.backupSince === null;
      const closingBackup = data.routing === 'HOLITA' && previous.backupSince !== null;
      const backupSince = enteringBackup ? (data.routingAheadSince ?? now) : previous.backupSince;
      const closedSeconds =
        closingBackup && backupSince !== null
          ? Math.max(0, Math.floor((now.getTime() - backupSince.getTime()) / 1000))
          : 0;
      if (event !== null) {
        await tx.fleetEvent.createMany({ data: [{ ...event, ...scope }], skipDuplicates: true });
      }
      await tx.karmaMonitoringTruck.updateMany({
        where: { ...scope, karmaCarId },
        data: {
          ...data,
          backupSince: closingBackup ? null : backupSince,
          ...(closingBackup
            ? {
                lastBackupStartedAt: backupSince,
                lastBackupEndedAt: now,
                backupSeconds: previous.backupSeconds + closedSeconds,
              }
            : {}),
          ...(data.routing === 'HOLITA' ? { recoveryBlocked: false } : {}),
        },
      });
    });
  }

  async beginRecovery(scope: FleetScope, truck: KarmaMonitoringTruck, now: Date) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.karmaMonitoringTruck.findUnique({
        where: { tenantId_branchId_karmaCarId: { ...scope, karmaCarId: truck.karmaCarId } },
      });
      if (
        current === null ||
        current.recoveryBlocked ||
        current.routing !== 'KARMA_BACKUP' ||
        current.karmaDeviceId !== truck.karmaDeviceId ||
        current.ignitionOffAt === null ||
        current.lastDataAt === null ||
        current.ignitionOffAt.getTime() > now.getTime() - 10 * 60_000 ||
        current.ignitionOffAt > current.lastDataAt ||
        current.lastDataAt > now ||
        current.lastDataAt.getTime() < now.getTime() - 70 * 60_000
      ) {
        return null;
      }
      const registered = await tx.device.findUnique({
        where: { ...scope, imei: current.karmaDeviceId },
        select: { id: true },
      });
      if (registered === null) {
        return null;
      }
      const previous = await tx.karmaRecoveryAttempt.findFirst({
        where: { ...scope, deviceImei: current.karmaDeviceId },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      });
      if (previous !== null && now.getTime() - previous.requestedAt.getTime() < 2 * 60 * 60_000) {
        return null;
      }
      const attempt = await tx.karmaRecoveryAttempt.create({
        data: {
          ...scope,
          karmaCarId: current.karmaCarId,
          deviceImei: current.karmaDeviceId,
          requestedAt: now,
          ignitionOffAt: current.ignitionOffAt,
          lastDataAt: current.lastDataAt,
        },
      });
      await tx.karmaMonitoringTruck.updateMany({
        where: { ...scope, karmaCarId: current.karmaCarId },
        data: { recoveryBlocked: true },
      });
      return attempt;
    });
  }

  async completeRecovery(
    scope: FleetScope,
    attempt: { id: string; karmaCarId: string },
    result: {
      status: 'ACCEPTED' | 'UNCERTAIN' | 'FAILED';
      queueIds: string[];
      errorCode: string | null;
    },
    now: Date,
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.karmaRecoveryAttempt.updateMany({
        where: { ...scope, id: attempt.id, karmaCarId: attempt.karmaCarId, status: 'SUBMITTING' },
        data: { ...result, completedAt: now },
      });
      if (updated.count > 0) {
        await tx.karmaMonitoringTruck.updateMany({
          where: { ...scope, karmaCarId: attempt.karmaCarId },
          data: { recoveryBlocked: result.status === 'UNCERTAIN' },
        });
      }
    });
  }

  async observe(
    scope: FleetScope,
    data: MonitoringTruckData,
    offlineAfterMinutes: number,
    now: Date,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const previous = await tx.karmaMonitoringTruck.findUnique({
        where: { tenantId_branchId_karmaCarId: { ...scope, karmaCarId: data.karmaCarId } },
      });
      const lastDataAt = data.lastDataAt ?? previous?.lastDataAt ?? null;
      const observed = { ...data, lastDataAt, ignitionOffAt: data.ignitionOffAt ?? null };
      const online =
        lastDataAt !== null && lastDataAt.getTime() > now.getTime() - offlineAfterMinutes * 60_000;
      const changed = !previous || previous.online !== online;
      const truck = await tx.karmaMonitoringTruck.upsert({
        where: { tenantId_branchId_karmaCarId: { ...scope, karmaCarId: data.karmaCarId } },
        create: {
          ...scope,
          ...observed,
          online,
          onlineSince: online ? now : null,
          noDataSince: online ? null : (lastDataAt ?? now),
        },
        update: {
          ...observed,
          online,
          onlineSince: online ? (previous?.onlineSince ?? now) : null,
          noDataSince: online ? null : (lastDataAt ?? previous?.noDataSince ?? now),
        },
      });
      if (changed) {
        await tx.karmaMonitoringEvent.create({
          data: {
            ...scope,
            karmaCarId: truck.karmaCarId,
            kind: online ? 'CAME_ONLINE' : 'NO_DATA_SINCE',
            source: 'STATUS_POLL',
            sourceKey: `${truck.karmaCarId}:${now.toISOString()}`,
            occurredAt: now,
            recordedAt: now,
            rawRecord: {
              lastDataAt: truck.lastDataAt?.toISOString() ?? null,
              onlineSince: truck.onlineSince?.toISOString() ?? null,
              noDataSince: truck.noDataSince?.toISOString() ?? null,
            },
            details: online
              ? 'Data received within the configured interval.'
              : 'No data since the recorded source time; device power state is unknown.',
          },
        });
      }
      return truck;
    });
  }

  updateTruck(
    scope: FleetScope,
    karmaCarId: string,
    data: Prisma.KarmaMonitoringTruckUpdateManyMutationInput,
  ) {
    return this.prisma.client.karmaMonitoringTruck.updateMany({
      where: { ...scope, karmaCarId },
      data,
    });
  }

  async record(scope: FleetScope, events: MonitoringEventData[]) {
    if (events.length) {
      await this.prisma.client.karmaMonitoringEvent.createMany({
        data: events.map((event) => ({ ...event, ...scope })),
        skipDuplicates: true,
      });
    }
  }

  async saveHistory(
    scope: FleetScope,
    karmaCarId: string,
    events: MonitoringEventData[],
    data: Pick<
      Prisma.KarmaMonitoringTruckUpdateManyMutationInput,
      'historyCursor' | 'historyBeforeId' | 'historyHighWatermark' | 'lastHistoryPollAt'
    >,
  ) {
    await this.prisma.client.$transaction([
      this.prisma.client.karmaMonitoringEvent.createMany({
        data: events.map((event) => ({ ...event, ...scope })),
        skipDuplicates: true,
      }),
      this.prisma.client.karmaMonitoringTruck.updateMany({ where: { ...scope, karmaCarId }, data }),
    ]);
  }

  prune(scope: FleetScope, cutoff: Date) {
    return this.prisma.client.karmaMonitoringEvent.deleteMany({
      where: { ...scope, occurredAt: { lt: cutoff } },
    });
  }

  async listTrucks(
    scope: FleetScope,
    page: { offset: number; limit: number },
    criteria: {
      tokens: string[];
      ids: string[] | undefined;
      online: boolean | undefined;
      withFaults: boolean | undefined;
    },
    sort: { field: 'DISPLAY_NAME' | 'LAST_DATA_AT'; direction: SortDirection },
    now: Date,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const settings =
          (await tx.karmaMonitoringSettings.findUnique({ where: { tenantId_branchId: scope } })) ??
          monitoringDefaults;
        const freshAfter = new Date(now.getTime() - settings.offlineAfterMinutes * 60_000);
        const faultCars = await tx.karmaMonitoringEvent.findMany({
          where: {
            ...scope,
            kind: 'FAULT_REPORTED',
            occurredAt: { gte: new Date(now.getTime() - settings.retentionDays * 86_400_000) },
            karmaCarId: { not: null },
          },
          distinct: ['karmaCarId'],
          select: { karmaCarId: true },
        });
        const faultCarIds = faultCars.flatMap((event) =>
          event.karmaCarId === null ? [] : [event.karmaCarId],
        );
        const withFaults = { karmaCarId: { in: faultCarIds } };
        const fresh = { lastDataAt: { gt: freshAfter } };
        const allTrucks = await tx.karmaMonitoringTruck.count({ where: scope });
        const onlineTotal = await tx.karmaMonitoringTruck.count({ where: { ...scope, ...fresh } });
        const withFaultsTotal = await tx.karmaMonitoringTruck.count({
          where: { ...scope, ...withFaults },
        });
        const where: Prisma.KarmaMonitoringTruckWhereInput = {
          ...scope,
          ...(criteria.ids ? { id: { in: criteria.ids } } : {}),
          ...(criteria.online === undefined
            ? {}
            : criteria.online
              ? { lastDataAt: { gt: freshAfter } }
              : { OR: [{ lastDataAt: null }, { lastDataAt: { lte: freshAfter } }] }),
          AND: [
            ...(criteria.withFaults === undefined
              ? []
              : [criteria.withFaults ? withFaults : { NOT: withFaults }]),
            ...criteria.tokens.map((token) => ({
              OR: [
                { displayName: literalContains(token) },
                { karmaCarId: literalContains(token) },
                { karmaDeviceId: literalContains(token) },
              ],
            })),
          ],
        };
        const items = await tx.karmaMonitoringTruck.findMany({
          where,
          skip: page.offset,
          take: page.limit,
          orderBy: [
            sort.field === 'LAST_DATA_AT'
              ? { lastDataAt: nullsLast(sort.direction) }
              : { displayName: prismaDirection(sort.direction) },
            { id: 'asc' },
          ],
        });
        const faults = await tx.karmaMonitoringEvent.findMany({
          where: {
            ...scope,
            karmaCarId: { in: items.map((truck) => truck.karmaCarId) },
            kind: 'FAULT_REPORTED',
            occurredAt: { gte: new Date(now.getTime() - settings.retentionDays * 86_400_000) },
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        });
        return {
          onlineTotal,
          noDataTotal: allTrucks - onlineTotal,
          withFaultsTotal,
          items: items.map((truck) => {
            const online = truck.lastDataAt !== null && truck.lastDataAt > freshAfter;
            const reported = faults.filter((fault) => fault.karmaCarId === truck.karmaCarId);
            return {
              ...truck,
              online,
              onlineSince: online ? truck.onlineSince : null,
              noDataSince: online
                ? null
                : (truck.noDataSince ?? truck.lastDataAt ?? truck.createdAt),
              faults: reported,
              latestFault: reported[0] ?? null,
            };
          }),
          total: await tx.karmaMonitoringTruck.count({ where }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async listEvents(
    scope: FleetScope,
    page: { offset: number; limit: number },
    where: Prisma.KarmaMonitoringEventWhereInput,
    now: Date,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const settings =
          (await tx.karmaMonitoringSettings.findUnique({ where: { tenantId_branchId: scope } })) ??
          monitoringDefaults;
        const scoped = {
          AND: [
            scope,
            where,
            { occurredAt: { gte: new Date(now.getTime() - settings.retentionDays * 86_400_000) } },
          ],
        };
        const items = await tx.karmaMonitoringEvent.findMany({
          where: scoped,
          skip: page.offset,
          take: page.limit,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        });
        return { items, total: await tx.karmaMonitoringEvent.count({ where: scoped }) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
