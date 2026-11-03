import type { ErmConfigurationChangeStatus, PrismaClient } from '../../generated/prisma/client.js';
import type { EdataConfiguration } from '../../starlink/edata-configuration.js';

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
        status: 'FAILED',
        failureReason: 'Operation did not finish',
        baseline: {},
        steps: [],
      },
    });
  }

  save(
    id: string,
    steps: EdataChangeStep[],
    state: {
      status?: ErmConfigurationChangeStatus;
      failureReason?: string | null;
      finishedAt?: Date;
      baseline?: EdataConfiguration;
      intended?: string;
    } = {},
  ) {
    const { baseline, ...rest } = state;
    return this.client.ermConfigurationChange.update({
      where: { id },
      data: {
        ...rest,
        ...(baseline && { baseline: configurationJson(baseline) }),
        steps: steps.map(({ configuration, ...step }) => ({
          ...step,
          ...(configuration && { configuration: configurationJson(configuration) }),
        })),
      },
    });
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
