import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { FleetFaultCheck, FleetFaultFinding } from '../../generated/graphql/types.js';
import type { FleetScope } from '../../validation.js';
import { type FaultCheckEvidence, findingsJson, storedFaultCheck } from './fault-check.js';

const HOUR = 3_600_000;

@Injectable()
export class FaultCheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Vehicles with at least one Device, grouped by Branch, across all Tenants. */
  async vehicleScopes(): Promise<{ scope: FleetScope; vehicleIds: string[] }[]> {
    const devices = await this.prisma.client.device.findMany({
      where: { vehicleId: { not: null } },
      select: { tenantId: true, branchId: true, vehicleId: true },
      orderBy: [{ tenantId: 'asc' }, { branchId: 'asc' }],
    });
    const scopes = new Map<string, { scope: FleetScope; vehicleIds: Set<string> }>();
    for (const device of devices) {
      if (device.vehicleId === null) {
        continue;
      }
      const key = `${device.tenantId}/${device.branchId}`;
      const entry = scopes.get(key) ?? {
        scope: { tenantId: device.tenantId, branchId: device.branchId },
        vehicleIds: new Set<string>(),
      };
      entry.vehicleIds.add(device.vehicleId);
      scopes.set(key, entry);
    }
    return [...scopes.values()].map(({ scope, vehicleIds }) => ({
      scope,
      vehicleIds: [...vehicleIds],
    }));
  }

  async evidence(
    scope: FleetScope,
    vehicleIds: readonly string[],
    now: Date,
  ): Promise<Map<string, FaultCheckEvidence>> {
    const where = { tenantId: scope.tenantId, branchId: scope.branchId };
    const [faults, can, peaks, voltages] = await Promise.all([
      this.prisma.client.fleetEvent.findMany({
        where: {
          ...where,
          vehicleId: { in: [...vehicleIds] },
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          occurredAt: { lte: now },
        },
        select: {
          vehicleId: true,
          deviceImei: true,
          kind: true,
          severity: true,
          occurredAt: true,
          troubleCode: true,
          diagnosticReport: true,
          diagnosticStatus: true,
          diagnosticSpn: true,
          diagnosticFmi: true,
          details: true,
          alertStatus: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { diagnosticIndex: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.client.fleetEvent.findMany({
        where: {
          ...where,
          vehicleId: { in: [...vehicleIds] },
          kind: { in: ['CAN_DISCONNECTED', 'CAN_ERROR'] },
          occurredAt: { gte: new Date(now.getTime() - 24 * HOUR), lte: now },
        },
        select: { vehicleId: true, kind: true, occurredAt: true },
      }),
      this.prisma.client.vehicleStatusSample.groupBy({
        by: ['vehicleId'],
        where: {
          ...where,
          vehicleId: { in: [...vehicleIds] },
          recordedAt: { gte: new Date(now.getTime() - 7 * 24 * HOUR), lte: now },
        },
        _max: { externalVoltage: true, recordedAt: true },
      }),
      Promise.all(
        vehicleIds.map((vehicleId) =>
          this.prisma.client.vehicleStatusSample.findMany({
            where: {
              ...where,
              vehicleId,
              externalVoltage: { not: null },
              recordedAt: { gte: new Date(now.getTime() - 6 * HOUR), lte: now },
            },
            select: { externalVoltage: true, recordedAt: true },
            orderBy: { recordedAt: 'desc' },
            take: 3,
          }),
        ),
      ),
    ]);
    return new Map(
      vehicleIds.map((vehicleId, index) => {
        const peak = peaks.find((row) => row.vehicleId === vehicleId)?._max;
        return [
          vehicleId,
          {
            faults: faults.filter((event) => event.vehicleId === vehicleId),
            can: can.filter((event) => event.vehicleId === vehicleId),
            voltages: (voltages[index] ?? []).flatMap((sample) =>
              sample.externalVoltage === null
                ? []
                : [{ value: sample.externalVoltage, recordedAt: sample.recordedAt }],
            ),
            peakVoltage: peak?.externalVoltage ?? null,
            dataAsOf: peak?.recordedAt ?? null,
          },
        ];
      }),
    );
  }

  async save(
    scope: FleetScope,
    checkedAt: Date,
    checks: readonly { vehicleId: string; dataAsOf: Date | null; findings: FleetFaultFinding[] }[],
  ): Promise<void> {
    await this.prisma.client.$transaction(
      checks.map((check) => {
        const values = {
          checkedAt,
          dataAsOf: check.dataAsOf,
          findings: findingsJson(check.findings),
        };
        return this.prisma.client.vehicleFaultCheck.upsert({
          where: {
            tenantId_branchId_vehicleId: {
              tenantId: scope.tenantId,
              branchId: scope.branchId,
              vehicleId: check.vehicleId,
            },
          },
          create: { ...scope, vehicleId: check.vehicleId, ...values },
          update: values,
        });
      }),
    );
  }

  async forVehicles(
    scope: FleetScope,
    vehicleIds: readonly string[],
  ): Promise<Map<string, FleetFaultCheck>> {
    const rows = await this.prisma.client.vehicleFaultCheck.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        vehicleId: { in: [...vehicleIds] },
      },
    });
    return new Map(rows.map((row) => [row.vehicleId, storedFaultCheck(row)]));
  }
}
