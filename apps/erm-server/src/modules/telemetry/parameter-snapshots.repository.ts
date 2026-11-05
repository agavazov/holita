import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { sqlNullableText, sqlRows, sqlText } from '../../database/sql.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { TelemetryQuery } from './telemetry-query.js';

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
    parameterCount: number,
    startedAt: Date,
  ): Promise<StoredParameterSnapshot> {
    const snapshot = await this.prisma.client.ermParameterSnapshot.create({
      data: { unitId, parameterCount, startedAt },
      include: { values: { orderBy: { parameter: 'asc' } } },
    });
    const previousSnapshot = await this.prisma.client.ermParameterSnapshot.findFirst({
      where: {
        unitId,
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
    entries: { parameter: number; value: string | null; resultCode: string | null }[],
  ): Promise<void> {
    await this.prisma.client.$transaction([
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

  async history(queries: TelemetryQuery[]) {
    const selected = sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT q."unitId", history.id::text AS id, previous.id::text AS "previousId"
        FROM jsonb_to_recordset(${JSON.stringify(queries)}::jsonb)
          q("unitId" text, "offset" integer, "pageSize" integer, snapshot timestamptz)
        CROSS JOIN LATERAL (
          SELECT id, "startedAt" FROM ${this.table()}
          WHERE "unitId" = q."unitId" AND "startedAt" <= q.snapshot
          ORDER BY "startedAt" DESC, id DESC
          LIMIT q."pageSize" + 1 OFFSET q."offset"
        ) history
        LEFT JOIN LATERAL (
          SELECT id FROM ${this.table()}
          WHERE "unitId" = q."unitId" AND status = 'complete'
            AND ("startedAt", id) < (history."startedAt", history.id)
          ORDER BY "startedAt" DESC, id DESC LIMIT 1
        ) previous ON true
        ORDER BY q."unitId", history."startedAt" DESC, history.id DESC
      `),
    );
    const ids = selected.flatMap((row) => {
      const previousId = sqlNullableText(row, 'previousId');
      return previousId === null ? [sqlText(row, 'id')] : [sqlText(row, 'id'), previousId];
    });
    const rows = new Map(
      (
        await this.prisma.client.ermParameterSnapshot.findMany({
          where: { id: { in: ids } },
          include: { values: { orderBy: { parameter: 'asc' } } },
        })
      ).map((snapshot) => [snapshot.id, snapshot]),
    );
    return queries.map((query) => ({
      query,
      rows: selected
        .filter((row) => sqlText(row, 'unitId') === query.unitId)
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
