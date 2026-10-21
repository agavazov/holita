import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import type { FleetDeviceOperation, Prisma } from '../../generated/prisma/client.js';
import type { FleetScope } from '../../validation.js';
import { configurationParameters, evidenceWatermark } from './device-parameter-change.js';

export type DeviceOperationRow = FleetDeviceOperation;
export type DeviceOperationUpdate = Pick<
  Prisma.FleetDeviceOperationUpdateManyMutationInput,
  | 'status'
  | 'dispatchedAt'
  | 'completedAt'
  | 'nextCheckAt'
  | 'queueIds'
  | 'observations'
  | 'configuration'
  | 'configurationId'
  | 'errorCode'
  | 'phase'
  | 'phaseDispatchedAt'
  | 'readAfterMessageId'
  | 'profileId'
  | 'profileReadAt'
  | 'profileObservations'
  | 'baselineObservations'
  | 'baselineConfiguration'
  | 'baselineConfigurationId'
  | 'baselineReadAt'
  | 'definitionHex'
  | 'writeDispatchedAt'
  | 'writeQueueIds'
  | 'writeUncertain'
>;

export const MONITOR_SOURCE_SHA256 =
  '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0';

export interface DeviceParameterPreset {
  catalogId: string;
  catalogLabel: string;
  parameterId: number;
  name: string;
  profileIds: number[];
}

export interface DeviceWriteIntent {
  kind: 'ADD_PARAMETER' | 'UPDATE_INTERVAL';
  baselineOperationId: string;
  parameterId: number;
  intervalSeconds: number;
  catalogId: string | null;
}

export const DEVICE_OPERATION_DEADLINE_MS = 10 * 60_000;
const ACTIVE_STATUSES = [
  'QUEUED',
  'SUBMITTING',
  'WAITING',
  'UNKNOWN',
] satisfies FleetDeviceOperation['status'][];

@Injectable()
export class DeviceOperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDevice(scope: FleetScope, id: string) {
    return this.prisma.client.device.findFirst({
      where: { ...scope, id },
      select: { id: true, imei: true },
    });
  }

  find(scope: FleetScope, id: string): Promise<DeviceOperationRow | null> {
    return this.prisma.client.fleetDeviceOperation.findFirst({ where: { ...scope, id } });
  }

  history(scope: FleetScope, deviceId: string): Promise<DeviceOperationRow[]> {
    return this.prisma.client.fleetDeviceOperation.findMany({
      where: { ...scope, deviceId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
  }

  lastComplete(
    scope: FleetScope,
    deviceId: string,
    deviceImei: string,
  ): Promise<DeviceOperationRow | null> {
    return this.prisma.client.fleetDeviceOperation.findFirst({
      where: { ...scope, deviceId, deviceImei, status: 'COMPLETE' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    });
  }

  create(
    scope: FleetScope,
    target: Pick<DeviceOperationRow, 'deviceId' | 'deviceImei' | 'karmaCarId' | 'karmaDeviceId'>,
    now: Date,
  ): Promise<DeviceOperationRow> {
    return this.prisma.client.fleetDeviceOperation.create({
      data: {
        ...scope,
        ...target,
        requestedAt: now,
        nextCheckAt: now,
        deadlineAt: new Date(now.getTime() + DEVICE_OPERATION_DEADLINE_MS),
      },
    });
  }

  async createWrite(
    scope: FleetScope,
    baseline: DeviceOperationRow,
    intent: DeviceWriteIntent,
    now: Date,
  ): Promise<DeviceOperationRow> {
    const parameters = configurationParameters(baseline.configuration);
    return this.prisma.client.fleetDeviceOperation.create({
      data: {
        ...scope,
        deviceId: baseline.deviceId,
        deviceImei: baseline.deviceImei,
        karmaCarId: baseline.karmaCarId,
        karmaDeviceId: baseline.karmaDeviceId,
        ...intent,
        phase: intent.kind === 'ADD_PARAMETER' ? 'READ_PROFILE' : 'READ_PARAMETERS',
        previousIntervalSeconds:
          parameters.find((item) => item.parameterId === intent.parameterId)?.intervalSeconds ??
          null,
        baselineConfiguration: parameters.map((item) => ({ ...item })),
        baselineConfigurationId: baseline.configurationId,
        readAfterMessageId: evidenceWatermark(baseline.observations) ?? null,
        requestedAt: now,
        nextCheckAt: now,
        deadlineAt: new Date(now.getTime() + DEVICE_OPERATION_DEADLINE_MS),
      },
    });
  }

  async presets(): Promise<DeviceParameterPreset[]> {
    const catalogs = await this.prisma.client.edataCatalog.findMany({
      where: { sourceSha256: MONITOR_SOURCE_SHA256, extractorVersion: '1.0.0', schemaVersion: 1 },
      select: { id: true, packageLabel: true },
      orderBy: { id: 'asc' },
      take: 8,
    });
    const result: DeviceParameterPreset[] = [];
    for (const catalog of catalogs) {
      const rows = await this.prisma.client.edataCatalogParameter.findMany({
        where: { catalogId: catalog.id, sourceKey: 'monitor', parameterId: { gte: 0, lte: 65535 } },
        orderBy: { key: 'asc' },
        take: 4097,
      });
      if (rows.length > 4096) {
        continue;
      }
      const profiles = await this.prisma.client.edataCatalogProfile.findMany({
        where: { catalogId: catalog.id },
        select: { vendorId: true, setId: true },
        take: 4097,
      });
      const members = await this.prisma.client.edataCatalogSetMember.findMany({
        where: { catalogId: catalog.id, setId: { in: profiles.map((profile) => profile.setId) } },
        select: { setId: true, parameterId: true },
        take: 16385,
      });
      if (profiles.length > 4096 || members.length > 16384) {
        continue;
      }
      const grouped = new Map<number, typeof rows>();
      for (const row of rows) {
        grouped.set(row.parameterId, [...(grouped.get(row.parameterId) ?? []), row]);
      }
      for (const [parameterId, choices] of grouped) {
        const names = new Set(choices.map((row) => row.name.trim()));
        if (
          names.size !== 1 ||
          !choices[0]?.name.trim() ||
          choices.some(
            (row) =>
              !row.details ||
              typeof row.details !== 'object' ||
              Array.isArray(row.details) ||
              !Array.isArray(row.details.issues) ||
              row.details.issues.length !== 0,
          )
        ) {
          continue;
        }
        const sets = new Set(
          members.filter((item) => item.parameterId === parameterId).map((item) => item.setId),
        );
        const profileIds = [
          ...new Set(
            profiles
              .filter((profile) => sets.has(profile.setId))
              .map((profile) => profile.vendorId),
          ),
        ].sort((a, b) => a - b);
        if (profileIds.length) {
          result.push({
            catalogId: catalog.id,
            catalogLabel: catalog.packageLabel,
            parameterId,
            name: choices[0].name.trim(),
            profileIds,
          });
        }
      }
    }
    return result.sort(
      (a, b) => a.catalogId.localeCompare(b.catalogId) || a.parameterId - b.parameterId,
    );
  }

  /** Only the trusted worker enumerates due rows across scopes; subsequent writes use the stored scope. */
  async claim(now: Date): Promise<DeviceOperationRow | null> {
    const available: Prisma.FleetDeviceOperationWhereInput = {
      status: { in: ACTIVE_STATUSES },
      nextCheckAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    };
    const candidate = await this.prisma.client.fleetDeviceOperation.findFirst({
      where: available,
      orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }],
    });
    if (!candidate) {
      return null;
    }
    const leaseToken = randomUUID();
    const acquired = await this.prisma.client.fleetDeviceOperation.updateMany({
      where: {
        ...available,
        id: candidate.id,
        tenantId: candidate.tenantId,
        branchId: candidate.branchId,
      },
      data: {
        leaseToken,
        leaseUntil: new Date(now.getTime() + 30_000),
        attempts: { increment: 1 },
      },
    });
    if (acquired.count !== 1) {
      return null;
    }
    return this.prisma.client.fleetDeviceOperation.findFirst({
      where: {
        id: candidate.id,
        tenantId: candidate.tenantId,
        branchId: candidate.branchId,
        leaseToken,
      },
    });
  }

  async currentDevice(operation: DeviceOperationRow): Promise<boolean> {
    const device = await this.prisma.client.device.findFirst({
      where: {
        tenantId: operation.tenantId,
        branchId: operation.branchId,
        id: operation.deviceId,
        imei: operation.deviceImei,
      },
      select: { id: true },
    });
    return device !== null;
  }

  /** A paused or replaced worker cannot publish results after its lease expires. */
  async save(
    operation: DeviceOperationRow,
    data: DeviceOperationUpdate,
    now: Date,
    release = true,
  ): Promise<boolean> {
    if (!operation.leaseToken) {
      return false;
    }
    const updated = await this.prisma.client.fleetDeviceOperation.updateMany({
      where: {
        id: operation.id,
        tenantId: operation.tenantId,
        branchId: operation.branchId,
        leaseToken: operation.leaseToken,
        leaseUntil: { gt: now },
        ...(data.status === 'COMPLETE' || data.status === 'SUBMITTING'
          ? {
              device: {
                tenantId: operation.tenantId,
                branchId: operation.branchId,
                id: operation.deviceId,
                imei: operation.deviceImei,
              },
            }
          : {}),
      },
      data: { ...data, ...(release ? { leaseToken: null, leaseUntil: null } : {}) },
    });
    return updated.count === 1;
  }
}
