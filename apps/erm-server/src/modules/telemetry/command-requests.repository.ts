import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  Prisma,
  type ErmCommandRequest,
  type ErmCommandRequestStatus,
} from '../../generated/prisma/client.js';
import type {
  ErmDeviceAction,
  ErmCommand,
  ErmFrame,
  ErmConfigurationChange,
} from '../../generated/graphql/types.js';
import { sqlRows, sqlText } from '../../database/sql.js';
import type { OperatorAudit, OperatorScope } from './operator-audit.js';
import { commandView, frameView } from './command-evidence.js';
import { configurationChangeView } from './configuration-change-view.js';
import { EdataChangeRepository } from './edata-change.repository.js';

export interface CommandRequestRelations {
  commands: Map<string, ErmCommand>;
  frames: Map<string, ErmFrame | null>;
  configurations: Map<string, ErmConfigurationChange | null>;
}

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

  findById(scope: OperatorScope, id: string) {
    return this.prisma.client.ermCommandRequest.findFirst({ where: { ...scope, id } });
  }

  async related(
    scope: OperatorScope,
    requests: ErmCommandRequest[],
  ): Promise<CommandRequestRelations> {
    const linked = requests.filter(
      (request): request is ErmCommandRequest & { commandId: string } =>
        request.tenantId === scope.tenantId &&
        request.branchId === scope.branchId &&
        request.commandId !== null,
    );
    if (!linked.length) {
      return { commands: new Map(), frames: new Map(), configurations: new Map() };
    }
    const commands = await this.prisma.client.ermCommand.findMany({
      where: {
        OR: linked.map((request) => ({ id: request.commandId, unitId: request.unitId })),
      },
    });
    const frames = commands.length
      ? await this.prisma.client.ermFrame.findMany({
          where: {
            direction: 'HOLITA',
            partial: false,
            OR: commands.map((command) => ({
              unitId: command.unitId,
              connectionId: command.connectionId,
              reference: command.reference,
              command: command.command,
            })),
          },
          orderBy: { receivedAt: 'asc' },
        })
      : [];
    const configurations = await this.prisma.client.ermConfigurationChange.findMany({
      where: {
        ...scope,
        actorId: { not: null },
        OR: linked.map((request) => ({
          deviceId: request.deviceId,
          unitId: request.unitId,
          steps: { array_contains: [{ commandId: request.commandId }] },
        })),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    const stepCommands = await new EdataChangeRepository(this.prisma.client).commands(
      configurations,
    );
    const commandViews = new Map(
      [...commands, ...stepCommands].map((command) => [command.id, commandView(command)]),
    );
    return {
      commands: commandViews,
      frames: new Map(
        commands.map((command) => {
          const frame = frames.find(
            (frame) =>
              frame.unitId === command.unitId &&
              frame.connectionId === command.connectionId &&
              frame.reference === command.reference &&
              frame.command === command.command,
          );
          return [command.id, frame ? frameView(frame) : null];
        }),
      ),
      configurations: new Map(
        linked.map((request) => {
          const change = configurations.find(
            (change) =>
              change.deviceId === request.deviceId &&
              change.unitId === request.unitId &&
              Array.isArray(change.steps) &&
              change.steps.some(
                (step) =>
                  typeof step === 'object' &&
                  step !== null &&
                  !Array.isArray(step) &&
                  step['commandId'] === request.commandId,
              ),
          );
          return [request.id, change ? configurationChangeView(change, commandViews) : null];
        }),
      ),
    };
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
