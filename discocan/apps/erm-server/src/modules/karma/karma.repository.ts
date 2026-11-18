import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma, type ErmKarmaRouting } from '../../generated/prisma/client.js';
import type { OperatorScope } from '../telemetry/operator-audit.js';

const attemptRelations = { recovery: true, discocanConnection: true } as const;

export type KarmaAttempt = Prisma.ErmKarmaReturnAttemptGetPayload<{
  include: typeof attemptRelations;
}>;

@Injectable()
export class KarmaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async evidence(unitId: string) {
    const [previous, frame] = await Promise.all([
      this.prisma.client.ermKarmaRouting.findFirst({
        where: { unitId },
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.ermFrame.findFirst({
        where: { unitId, direction: 'DEVICE' },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
    ]);
    return { previous, lastFrameAt: frame?.receivedAt ?? null };
  }

  observe(
    previous: ErmKarmaRouting | null,
    data: Pick<
      ErmKarmaRouting,
      'unitId' | 'state' | 'since' | 'observedAt' | 'latestKarmaReportAt' | 'parked'
    >,
  ) {
    if (previous?.state === data.state) {
      return this.prisma.client.ermKarmaRouting.update({ where: { id: previous.id }, data });
    }
    return this.prisma.client.ermKarmaRouting.create({
      data: {
        ...data,
        createdAt: data.observedAt,
        notificationKind:
          data.state === 'KARMA_BACKUP'
            ? 'UNIT_ON_BACKUP'
            : data.state === 'DISCOCAN' && previous?.state === 'KARMA_BACKUP'
              ? 'UNIT_RETURNED_TO_DISCOCAN'
              : null,
      },
    });
  }

  async routing(scope: OperatorScope, devices: { id: string; imei: string }[]) {
    const [routes, attempts] = await Promise.all([
      this.prisma.client.ermKarmaRouting.findMany({
        where: { unitId: { in: devices.map((device) => device.imei) } },
        distinct: ['unitId'],
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.ermKarmaReturnAttempt.findMany({
        where: {
          ...scope,
          OR: devices.map((device) => ({ deviceId: device.id, unitId: device.imei })),
        },
        distinct: ['deviceId'],
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        include: attemptRelations,
      }),
    ]);
    return { routes, attempts };
  }

  // Operator returns carry their Branch and Device; automatic returns omit all three.
  async createAttempt(data: {
    tenantId?: string;
    branchId?: string;
    deviceId?: string;
    unitId: string;
    actorId: string;
    requestedAt: Date;
  }) {
    try {
      return await this.prisma.client.ermKarmaReturnAttempt.create({
        data,
        include: attemptRelations,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A return to discocan is already pending');
      }
      throw error;
    }
  }

  pending(unitId: string) {
    return this.prisma.client.ermKarmaReturnAttempt.findFirst({ where: { unitId, pending: true } });
  }

  latestAttempt(unitId: string) {
    return this.prisma.client.ermKarmaReturnAttempt.findFirst({
      where: { unitId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });
  }

  submitted(id: string, result: { status: 'ACCEPTED' | 'UNCERTAIN'; queueId: string | null }) {
    return this.prisma.client.ermKarmaReturnAttempt.update({
      where: { id },
      data: {
        queueId: result.queueId,
        status: result.status === 'ACCEPTED' ? 'QUEUED' : 'UNCERTAIN',
      },
      include: attemptRelations,
    });
  }

  failed(id: string) {
    return this.prisma.client.ermKarmaReturnAttempt.update({
      where: { id },
      data: { status: 'FAILED', pending: false },
    });
  }

  async reconcile(unitId: string): Promise<void> {
    const attempt = await this.prisma.client.ermKarmaReturnAttempt.findFirst({
      where: { unitId, status: { not: 'FAILED' } },
      orderBy: { requestedAt: 'desc' },
    });
    if (!attempt || attempt.discocanConnectionId !== null) {
      return;
    }
    const [recovery, connection] = await Promise.all([
      this.prisma.client.ermRecoverySession.findFirst({
        where: { unitId, startedAt: { gte: attempt.requestedAt } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.client.ermConnection.findFirst({
        where: { unitId, openedAt: { gt: attempt.requestedAt } },
        orderBy: { openedAt: 'asc' },
      }),
    ]);
    if (!recovery && !connection) {
      return;
    }
    await this.prisma.client.ermKarmaReturnAttempt.update({
      where: { id: attempt.id },
      data: {
        ...(recovery ? { recoverySessionId: recovery.id } : {}),
        ...(connection ? { discocanConnectionId: connection.id } : {}),
        ...(connection
          ? { status: 'RETURNED', pending: false }
          : recovery?.outcome === 'NEEDS_OPERATOR'
            ? { status: 'NEEDS_OPERATOR', pending: false }
            : {}),
      },
    });
  }
}
