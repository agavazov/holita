import type { PrismaClient } from '../../generated/prisma/client.js';
import type { ParametersChangeOptions } from './edata-change.js';
import type { OperatorAudit, OperatorScope } from './operator-audit.js';

/** Configuration batches use the same ordered, scoped batch audit as read commands. */
export class ConfigurationBatchesRepository {
  constructor(private readonly client: PrismaClient) {}

  create(targets: { audit: OperatorAudit; options: ParametersChangeOptions }[]) {
    const first = targets[0];
    if (!first) {
      throw new Error('Expected configuration batch targets');
    }
    return this.client.ermCommandBatch.create({
      data: {
        tenantId: first.audit.tenantId,
        branchId: first.audit.branchId,
        actorId: first.audit.actorId,
        createdAt: new Date(),
        configurationChanges: {
          create: targets.map(({ audit, options }, batchIndex) => ({
            deviceId: audit.deviceId,
            actorId: audit.actorId,
            intent: audit.intent,
            unitId: options.unitId,
            operation: 'PARAMETERS',
            parameters: options.parameters.map(({ parameter }) => Number(parameter)),
            batchIndex,
            status: 'RUNNING',
            baseline: {},
            intended: JSON.stringify(options.parameters),
            steps: [],
          })),
        },
      },
      include: { configurationChanges: { orderBy: { batchIndex: 'asc' } } },
    });
  }

  find(scope: OperatorScope, id: string) {
    return this.client.ermCommandBatch.findFirst({
      where: { ...scope, id, action: null },
      include: { configurationChanges: { where: scope, orderBy: { batchIndex: 'asc' } } },
    });
  }

  async stop(scope: OperatorScope, id: string, actorId: string): Promise<void> {
    await this.client.ermCommandBatch.updateMany({
      where: { ...scope, id, action: null, stoppedAt: null, finishedAt: null },
      data: { stoppedAt: new Date(), stoppedByActorId: actorId },
    });
  }

  async finish(scope: OperatorScope, id: string): Promise<void> {
    const finishedAt = new Date();
    await this.client.ermConfigurationChange.updateMany({
      where: { ...scope, batchId: id, status: 'RUNNING', finishedAt: null },
      data: {
        status: 'REFUSED',
        finishedAt,
        failureReason:
          'Batch stopped before this unit; a preceding result was not VERIFIED or an operator stopped it',
      },
    });
    await this.client.ermCommandBatch.updateMany({
      where: { ...scope, id, action: null, finishedAt: null },
      data: { finishedAt },
    });
  }

  async interrupt(finishedAt: Date): Promise<void> {
    await this.client.ermCommandBatch.updateMany({
      where: { action: null, finishedAt: null },
      data: { finishedAt },
    });
  }
}
