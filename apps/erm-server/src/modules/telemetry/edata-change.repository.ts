import { BadRequestException } from '@nestjs/common';
import type { DeviceCommand } from '../devices/command.js';
import type { ErmConfigurationChangeStatus, PrismaClient } from '../../generated/prisma/client.js';
import type { EdataConfiguration } from '../../starlink/edata-configuration.js';
import { Prisma } from '../../generated/prisma/client.js';
import { sqlRows, sqlText } from '../../database/sql.js';

export interface EdataChangeStep {
  name: string;
  commandId: string | null;
  time: string;
  outcome: string;
  configuration?: EdataConfiguration;
  payload?: string;
}

function configurationJson(configuration: EdataConfiguration) {
  return {
    ...configuration,
    definitions: configuration.definitions.map((definition) => ({ ...definition })),
  };
}

export class EdataChangeRepository {
  constructor(private readonly client: PrismaClient) {}

  create(unitId: string, parameter: number | null) {
    return this.client.ermConfigurationChange.create({
      data: {
        unitId,
        parameter,
        status: 'RUNNING',
        baseline: {},
        steps: [],
      },
    });
  }

  async interruptUnfinished(finishedAt: Date, id?: string): Promise<void> {
    const where = { finishedAt: null, ...(id === undefined ? {} : { id }) };
    await this.client.ermConfigurationChange.updateMany({
      where: { ...where, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        finishedAt,
        failureReason: 'Configuration operation was interrupted before completion',
      },
    });
    await this.client.ermConfigurationChange.updateMany({
      where: { ...where, status: 'UNCERTAIN' },
      data: {
        finishedAt,
        failureReason:
          'Configuration submission was interrupted; operator review and a fresh read are required',
      },
    });
  }

  async history(unitIds: string[], schema: string) {
    const table = Prisma.raw(`"${schema.replaceAll('"', '""')}"."ermConfigurationChange"`);
    const selected = sqlRows(
      await this.client.$queryRaw(Prisma.sql`
      SELECT history.id::text AS id
      FROM unnest(${unitIds}::text[]) AS units("unitId")
      CROSS JOIN LATERAL (
        SELECT id FROM ${table}
        WHERE "unitId" = units."unitId"
        ORDER BY "startedAt" DESC, id DESC LIMIT 20
      ) history
    `),
    );
    return this.client.ermConfigurationChange.findMany({
      where: { id: { in: selected.map((row) => sqlText(row, 'id')) } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
  }

  save(
    id: string,
    steps: EdataChangeStep[],
    state: {
      status?: ErmConfigurationChangeStatus;
      failureReason?: string | null;
      finishedAt?: Date;
      baseline?: EdataConfiguration | { globals: string } | { parameter: string; value: string };
      intended?: string;
    } = {},
  ) {
    const { baseline, ...rest } = state;
    return this.client.ermConfigurationChange.update({
      where: { id },
      data: {
        ...rest,
        ...(baseline && {
          baseline: 'definitions' in baseline ? configurationJson(baseline) : baseline,
        }),
        steps: steps.map(({ configuration, ...step }) => ({
          ...step,
          ...(configuration && { configuration: configurationJson(configuration) }),
        })),
      },
    });
  }

  // The gateway accepts globals only from a submission already recorded by this workflow.
  async globalsCommand(id: string, unitId: string): Promise<DeviceCommand> {
    const change = await this.client.ermConfigurationChange.findUnique({ where: { id } });
    const storedSteps = change?.steps;
    const step = Array.isArray(storedSteps) ? storedSteps.at(-1) : undefined;
    if (
      change?.unitId !== unitId ||
      change.status !== 'UNCERTAIN' ||
      change.finishedAt !== null ||
      change.parameter !== null ||
      typeof step !== 'object' ||
      step === null ||
      Array.isArray(step) ||
      (step['name'] !== 'write' && step['name'] !== 'restore') ||
      step['outcome'] !== 'SUBMITTING' ||
      typeof step['payload'] !== 'string' ||
      !/^[0-9A-F]{98}$/.test(step['payload'])
    ) {
      throw new BadRequestException('Expected a pending globals workflow submission');
    }
    return { command: '30', fields: ['19', '0', '19', '302', '0', '1', '1', step['payload']] };
  }

  async needsFreshRead(unitId: string): Promise<boolean> {
    const previous = await this.client.ermConfigurationChange.findFirst({
      where: { unitId, status: { in: ['READ', 'UNCERTAIN'] } },
      orderBy: { startedAt: 'desc' },
    });
    return previous?.status === 'UNCERTAIN';
  }

  async watermark(unitId: string): Promise<bigint> {
    const row = await this.client.ermEvent.findFirst({
      where: { unitId },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return row?.id ?? 0n;
  }

  async observations(unitId: string, after: bigint, since: Date) {
    const rows = await this.client.ermEvent.findMany({
      where: {
        unitId,
        eventId: '33',
        id: { gt: after },
        frame: { direction: 'DEVICE', partial: false, receivedAt: { gte: since } },
      },
      orderBy: { id: 'asc' },
      select: { id: true, fields: true, frame: { select: { receivedAt: true } } },
    });
    return rows.flatMap((row) => {
      const extra =
        typeof row.fields === 'object' && row.fields !== null && !Array.isArray(row.fields)
          ? row.fields['extra']
          : undefined;
      if (
        !Array.isArray(extra) ||
        !extra.every((field): field is string => typeof field === 'string')
      ) {
        return [];
      }
      return [
        { eventId: String(row.id), receivedAt: row.frame.receivedAt.toISOString(), fields: extra },
      ];
    });
  }
}
