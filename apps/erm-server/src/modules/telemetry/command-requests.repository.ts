import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma, type ErmCommandRequestStatus } from '../../generated/prisma/client.js';
import type { ErmDeviceAction } from '../../generated/graphql/types.js';
import { sqlRows, sqlText } from '../../database/sql.js';
import type { OperatorAudit, OperatorScope } from './operator-audit.js';

@Injectable()
export class CommandRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    audit: OperatorAudit,
    unitId: string,
    action: ErmDeviceAction,
    createdAt: Date,
    expiresAt: Date,
  ) {
    return this.prisma.client.ermCommandRequest.create({
      data: { ...audit, unitId, action, createdAt, expiresAt },
    });
  }

  async interrupt(completedAt: Date): Promise<void> {
    await this.prisma.client.ermCommandRequest.updateMany({
      where: { status: 'SUBMITTING' },
      data: {
        status: 'UNCERTAIN',
        completedAt,
        failureReason:
          'Submission was interrupted; the command may have reached the unit and will not be replayed',
      },
    });
  }

  async expire(now: Date): Promise<void> {
    await this.prisma.client.ermCommandRequest.updateMany({
      where: { status: 'QUEUED', expiresAt: { lte: now } },
      data: {
        status: 'EXPIRED',
        completedAt: now,
        failureReason: 'Request expired before submission',
      },
    });
  }

  pending(now: Date, unitIds: string[]) {
    return this.prisma.client.ermCommandRequest.findMany({
      where: { status: 'QUEUED', unitId: { in: unitIds }, expiresAt: { gt: now } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
  }

  async claim(id: string, submittedAt: Date): Promise<boolean> {
    const changed = await this.prisma.client.ermCommandRequest.updateMany({
      where: { id, status: 'QUEUED', expiresAt: { gt: submittedAt } },
      data: { status: 'SUBMITTING', submittedAt },
    });
    return changed.count === 1;
  }

  async rejectTarget(id: string, completedAt: Date): Promise<void> {
    await this.prisma.client.ermCommandRequest.updateMany({
      where: { id, status: 'QUEUED' },
      data: {
        status: 'FAILED',
        completedAt,
        failureReason: 'Fleet Device ownership or IMEI changed before submission',
      },
    });
  }

  finish(
    id: string,
    state: {
      status: ErmCommandRequestStatus;
      completedAt: Date;
      failureReason?: string | null;
      commandId?: string;
      resultCode?: string | null;
      responseText?: string | null;
    },
  ) {
    return this.prisma.client.ermCommandRequest.update({ where: { id }, data: state });
  }

  async cancel(
    scope: OperatorScope,
    deviceId: string,
    id: string,
    completedAt: Date,
  ): Promise<boolean> {
    const changed = await this.prisma.client.ermCommandRequest.updateMany({
      where: { ...scope, deviceId, id, status: 'QUEUED' },
      data: { status: 'CANCELLED', completedAt, failureReason: 'Cancelled before submission' },
    });
    return changed.count === 1;
  }

  find(scope: OperatorScope, deviceId: string, id: string) {
    return this.prisma.client.ermCommandRequest.findFirst({ where: { ...scope, deviceId, id } });
  }

  async history(scope: OperatorScope, deviceIds: string[]) {
    const table = Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."ermCommandRequest"`);
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT history.id::text AS id FROM unnest(${deviceIds}::uuid[]) devices("deviceId")
      CROSS JOIN LATERAL (
        SELECT id FROM ${table} WHERE "tenantId" = ${scope.tenantId}::uuid
          AND "branchId" = ${scope.branchId}::uuid AND "deviceId" = devices."deviceId"
        ORDER BY "createdAt" DESC, id DESC LIMIT 50
      ) history
    `),
    );
    return this.prisma.client.ermCommandRequest.findMany({
      where: {
        ...scope,
        deviceId: { in: deviceIds },
        id: { in: selected.map((row) => sqlText(row, 'id')) },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
