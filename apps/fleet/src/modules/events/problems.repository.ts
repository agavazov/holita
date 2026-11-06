import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { FleetEventKind } from '../../generated/prisma/enums.js';
import type { FleetScope } from '../../validation.js';

const RECORDED_PROBLEM_KINDS: FleetEventKind[] = [
  'DIAGNOSTIC_TROUBLE_CODE',
  'CAN_ERROR',
  'CAN_DISCONNECTED',
  'POWER_DISCONNECTED',
  'LOW_BACKUP_BATTERY',
  'CRASH_DETECTED',
];

@Injectable()
export class ProblemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Complete scoped evidence and registry from one Fleet snapshot; paging happens after merging ERM. */
  snapshot(scope: FleetScope, period: { from: Date; to: Date }) {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const events = await transaction.fleetEvent.findMany({
          where: {
            tenantId: scope.tenantId,
            branchId: scope.branchId,
            OR: [
              { alertStatus: { in: ['OPEN', 'ACKNOWLEDGED'] } },
              {
                alertStatus: null,
                kind: { in: RECORDED_PROBLEM_KINDS },
                occurredAt: { gte: period.from, lt: period.to },
              },
            ],
          },
          select: {
            id: true,
            vehicleId: true,
            deviceImei: true,
            source: true,
            occurredAt: true,
            kind: true,
            severity: true,
            troubleCode: true,
            details: true,
            alertStatus: true,
            vehicle: {
              select: {
                id: true,
                licensePlate: true,
                fleetNumber: true,
                vehicleType: true,
                status: true,
              },
            },
          },
        });
        const devices = await transaction.device.findMany({
          where: { tenantId: scope.tenantId, branchId: scope.branchId },
          select: {
            id: true,
            imei: true,
            vehicleId: true,
            vehicle: {
              select: {
                id: true,
                licensePlate: true,
                fleetNumber: true,
                vehicleType: true,
                status: true,
              },
            },
          },
        });
        const dataClock = await transaction.vehicleStatusSample.aggregate({
          where: { tenantId: scope.tenantId, branchId: scope.branchId, deviceImei: { not: null } },
          _max: { recordedAt: true },
        });
        return { events, devices, dataAsOf: dataClock._max.recordedAt };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
