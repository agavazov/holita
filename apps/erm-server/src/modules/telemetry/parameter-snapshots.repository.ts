import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { sqlNullableText, sqlRows, sqlText } from '../../database/sql.js';
import { Prisma, type ErmParameterReadOutcome } from '../../generated/prisma/client.js';
import type { TelemetryQuery } from './telemetry-query.js';
import type { OperatorAudit, OperatorScope } from './operator-audit.js';

type ParameterSnapshotRecord = Prisma.ErmParameterSnapshotGetPayload<{
  include: { values: true };
}>;

export type StoredParameterSnapshot = ParameterSnapshotRecord & {
  previousSnapshot: ParameterSnapshotRecord | null;
};

@Injectable()
export class ParameterSnapshotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private table() {
    return Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."ermParameterSnapshot"`);
  }

  async create(
    unitId: string,
    parameters: readonly number[],
    startedAt: Date,
    audit?: OperatorAudit,
  ): Promise<StoredParameterSnapshot> {
    const snapshot = await this.prisma.client.ermParameterSnapshot.create({
      data: {
        unitId,
        parameterCount: parameters.length,
        startedAt,
        ...audit,
        values: {
          createMany: { data: parameters.map((parameter) => ({ parameter, outcome: 'OMITTED' })) },
        },
      },
      include: { values: { orderBy: { parameter: 'asc' } } },
    });
    const previousSnapshot = await this.prisma.client.ermParameterSnapshot.findFirst({
      where: {
        unitId,
        tenantId: audit?.tenantId ?? null,
        branchId: audit?.branchId ?? null,
        deviceId: audit?.deviceId ?? null,
        actorId: audit === undefined ? null : { not: null },
        status: 'COMPLETE',
        OR: [{ startedAt: { lt: startedAt } }, { startedAt, id: { lt: snapshot.id } }],
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      include: { values: { orderBy: { parameter: 'asc' } } },
    });
    return { ...snapshot, previousSnapshot };
  }

  async saveValues(
    id: string,
    entries: {
      parameter: number;
      value: string | null;
      resultCode: string | null;
      outcome: ErmParameterReadOutcome;
    }[],
  ): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.ermParameterValue.deleteMany({
        where: { snapshotId: id, parameter: { in: entries.map(({ parameter }) => parameter) } },
      }),
      this.prisma.client.ermParameterValue.createMany({
        data: entries.map((entry) => ({ snapshotId: id, ...entry })),
      }),
      this.prisma.client.ermParameterSnapshot.update({
        where: { id },
        data: { readCount: { increment: entries.length } },
      }),
    ]);
  }

  async complete(id: string, finishedAt: Date): Promise<void> {
    await this.prisma.client.ermParameterSnapshot.update({
      where: { id },
      data: { status: 'COMPLETE', finishedAt },
    });
  }

  async isComplete(id: string): Promise<boolean> {
    const snapshot = await this.prisma.client.ermParameterSnapshot.findUnique({
      where: { id },
      select: { status: true },
    });
    return snapshot?.status === 'COMPLETE';
  }

  async fail(id: string, reason: string, finishedAt: Date): Promise<void> {
    await this.prisma.client.ermParameterSnapshot.update({
      where: { id },
      data: { status: 'FAILED', failureReason: reason, finishedAt },
    });
  }

  async interruptRunning(finishedAt: Date): Promise<void> {
    await this.prisma.client.ermParameterSnapshot.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        finishedAt,
        failureReason: 'interrupted by an api restart',
      },
    });
  }

  async history(queries: (TelemetryQuery & { deviceId: string })[], scope: OperatorScope) {
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT q."deviceId", history.id::text AS id, previous.id::text AS "previousId"
        FROM jsonb_to_recordset(${JSON.stringify(queries)}::jsonb)
          q("deviceId" uuid, "offset" integer, "pageSize" integer, snapshot timestamptz)
        CROSS JOIN LATERAL (
          SELECT id, "startedAt", "unitId" FROM ${this.table()}
          WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
            AND "deviceId" = q."deviceId" AND "startedAt" <= q.snapshot
            AND "actorId" IS NOT NULL
          ORDER BY "startedAt" DESC, id DESC
          LIMIT q."pageSize" + 1 OFFSET q."offset"
        ) history
        LEFT JOIN LATERAL (
          SELECT id FROM ${this.table()}
          WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
            AND "deviceId" = q."deviceId" AND "unitId" = history."unitId" AND status = 'complete'
            AND "actorId" IS NOT NULL
            AND ("startedAt", id) < (history."startedAt", history.id)
          ORDER BY "startedAt" DESC, id DESC LIMIT 1
        ) previous ON true
        ORDER BY q."deviceId", history."startedAt" DESC, history.id DESC
      `),
    );
    const ids = selected.flatMap((row) => {
      const previousId = sqlNullableText(row, 'previousId');
      return previousId === null ? [sqlText(row, 'id')] : [sqlText(row, 'id'), previousId];
    });
    const rows = new Map(
      (
        await this.prisma.client.ermParameterSnapshot.findMany({
          where: {
            ...scope,
            actorId: { not: null },
            deviceId: { in: queries.map((query) => query.deviceId) },
            id: { in: ids },
          },
          include: { values: { orderBy: { parameter: 'asc' } } },
        })
      ).map((snapshot) => [snapshot.id, snapshot]),
    );
    return queries.map((query) => ({
      query,
      rows: selected
        .filter((row) => sqlText(row, 'deviceId') === query.deviceId)
        .flatMap((row): StoredParameterSnapshot[] => {
          const snapshot = rows.get(sqlText(row, 'id'));
          const previousId = sqlNullableText(row, 'previousId');
          return snapshot
            ? [{ ...snapshot, previousSnapshot: rows.get(previousId ?? '') ?? null }]
            : [];
        }),
    }));
  }
}
