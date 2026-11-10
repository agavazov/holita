import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type {
  ErmCommandRequest,
  SendErmDeviceCommandInput,
  CancelErmDeviceCommandInput,
  RetryErmDeviceCommandInput,
  StartErmCommandBatchInput,
  ErmCommandBatch,
  ErmCommandRequestsPage,
  ErmCommandRequestStatus,
  QueryErmCommandRequestsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { validateCommand } from '../devices/command.js';
import { primaryUnitIds } from '../devices/config.js';
import { CommandRequestsRepository } from './command-requests.repository.js';
import { commandRequestView } from './command-request-view.js';
import { deviceActions } from './device-actions.js';
import { FleetClient } from './fleet.client.js';
import { LiveDevicesService } from './live-devices.service.js';
import { auditId, operatorActor, operatorAudit, operatorScope } from './operator-audit.js';
import { requireOperator } from './operator-roles.js';
import type { DeviceReference } from './telemetry.service.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';
import {
  commandDeviceIds,
  commandRequestOptions,
  commandRequestsQuery,
} from './command-requests.query.js';

// Fleet asks every six hours; a request still waiting expires before the next one.
const SCHEDULED_FAULT_READ_SECONDS = 21_000;

@Injectable()
export class CommandRequestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommandRequestsService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;

  constructor(
    private readonly repository: CommandRequestsRepository,
    private readonly devices: LiveDevicesService,
    private readonly fleet: FleetClient,
    private readonly workflows: UnitWorkflowsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.repository.interrupt(new Date());
    this.timer = setInterval(() => {
      void this.tick().catch(() => {
        this.logger.error('Command queue tick failed');
      });
    }, 10_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  async request(
    input: SendErmDeviceCommandInput,
    context: RequestContext,
  ): Promise<ErmCommandRequest> {
    requireOperator(context);
    const scope = operatorScope(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    validateCommand(deviceActions[input.action]);
    const { seconds, intent } = commandRequestOptions(input);
    const createdAt = new Date();
    const request = await this.repository.create(
      { ...operatorAudit(context, input.deviceId, intent), ...scope },
      unitId,
      input.action,
      createdAt,
      new Date(createdAt.getTime() + seconds * 1000),
    );
    return commandRequestView(request, undefined, context);
  }

  /**
   * Fleet's scheduled fault-logger read for a configured primary unit. Dispatch verifies the
   * Fleet target again before sending, as for operator requests.
   */
  async scheduledFaultRead(imei: string, body: unknown): Promise<{ queued: boolean }> {
    if (!/^\d{15}$/.test(imei) || typeof body !== 'object' || body === null) {
      throw new BadRequestException('Expected a unit IMEI and its Fleet Device target');
    }
    const target = new Map(Object.entries(body));
    const audit = {
      tenantId: auditId(target.get('tenantId')),
      branchId: auditId(target.get('branchId')),
      deviceId: auditId(target.get('deviceId')),
      actorId: 'system:fault-scan',
      intent: 'Scheduled fault read',
    };
    const createdAt = new Date();
    if (
      !primaryUnitIds().has(imei) ||
      (await this.repository.pendingAction(audit.deviceId, 'READ_EDATA_FAULTS', createdAt))
    ) {
      return { queued: false };
    }
    validateCommand(deviceActions.READ_EDATA_FAULTS);
    await this.repository.create(
      audit,
      imei,
      'READ_EDATA_FAULTS',
      createdAt,
      new Date(createdAt.getTime() + SCHEDULED_FAULT_READ_SECONDS * 1000),
    );
    return { queued: true };
  }

  async cancel(
    input: CancelErmDeviceCommandInput,
    context: RequestContext,
  ): Promise<ErmCommandRequest> {
    requireOperator(context);
    const scope = operatorScope(context);
    await this.fleet.deviceImei(input.deviceId, context);
    const deviceId = auditId(input.deviceId),
      id = auditId(input.requestId);
    const request = await this.repository.find(scope, deviceId, id);
    if (!request) {
      throw new NotFoundException('Command request was not found in the active Branch');
    }
    if (!(await this.repository.cancel(scope, deviceId, id, new Date(), operatorActor(context)))) {
      throw new ConflictException('Only queued requests can be cancelled');
    }
    const cancelled = await this.repository.find(scope, deviceId, id);
    if (!cancelled) {
      throw new NotFoundException('Command request was not found in the active Branch');
    }
    return commandRequestView(cancelled, undefined, context);
  }

  async retry(
    input: RetryErmDeviceCommandInput,
    context: RequestContext,
  ): Promise<ErmCommandRequest> {
    requireOperator(context);
    const scope = operatorScope(context);
    const original = await this.repository.findById(scope, auditId(input.requestId));
    if (!original) {
      throw new NotFoundException('Command request was not found in the active Branch');
    }
    if (!['FAILED', 'EXPIRED', 'UNCERTAIN', 'CANCELLED'].includes(original.status)) {
      throw new ConflictException(
        'Only failed, expired, uncertain or cancelled requests can be retried',
      );
    }
    const unitId = await this.fleet.deviceImei(original.deviceId, context);
    const options = commandRequestOptions({
      ...input,
      action: original.action,
      intent: input.intent ?? original.intent,
    });
    validateCommand(deviceActions[original.action]);
    const createdAt = new Date();
    const request = await this.repository.create(
      operatorAudit(context, original.deviceId, options.intent),
      unitId,
      original.action,
      createdAt,
      new Date(createdAt.getTime() + options.seconds * 1000),
      original.id,
    );
    return commandRequestView(request, undefined, context);
  }

  async list(
    args: QueryErmCommandRequestsArgs,
    context: RequestContext,
  ): Promise<ErmCommandRequestsPage> {
    const scope = operatorScope(context);
    const page = await this.repository.list(scope, commandRequestsQuery(args));
    const related = await this.repository.related(scope, page.items);
    return {
      ...page,
      items: page.items.map((request) => commandRequestView(request, related, context)),
    };
  }

  async startBatch(
    input: StartErmCommandBatchInput,
    context: RequestContext,
  ): Promise<ErmCommandBatch> {
    requireOperator(context);
    const scope = operatorScope(context);
    const deviceIds = commandDeviceIds(input.deviceIds);
    const { seconds, intent } = commandRequestOptions(input);
    validateCommand(deviceActions[input.action]);
    const devices = await this.fleet.deviceImeis(deviceIds, context);
    const targets = deviceIds.map((deviceId) => {
      const unitId = devices.get(deviceId);
      if (!unitId) {
        throw new NotFoundException('Fleet device not found in the active Branch');
      }
      return { deviceId, unitId };
    });
    const createdAt = new Date();
    const id = await this.repository.createBatch(
      scope,
      operatorActor(context),
      targets,
      input.action,
      intent,
      createdAt,
      new Date(createdAt.getTime() + seconds * 1000),
    );
    const batch = await this.batch(id, context);
    if (!batch) {
      throw new NotFoundException('Command batch was not found in the active Branch');
    }
    return batch;
  }

  async batch(id: string, context: RequestContext): Promise<ErmCommandBatch | null> {
    const scope = operatorScope(context);
    const batch = await this.repository.batch(scope, auditId(id));
    if (!batch || batch.action === null) {
      return null;
    }
    const related = await this.repository.related(scope, batch.requests);
    const statuses: ErmCommandRequestStatus[] = [
      'QUEUED',
      'SUBMITTING',
      'ANSWERED',
      'FAILED',
      'EXPIRED',
      'CANCELLED',
      'UNCERTAIN',
    ];
    return {
      ...batch,
      action: batch.action,
      counts: statuses.map((status) => ({
        status,
        count: batch.requests.filter((request) => request.status === status).length,
      })),
      requests: batch.requests.map((request) => commandRequestView(request, related, context)),
    };
  }

  async stopBatch(id: string, context: RequestContext): Promise<ErmCommandBatch> {
    requireOperator(context);
    const scope = operatorScope(context);
    const batchId = auditId(id);
    if (!(await this.repository.stopBatch(scope, batchId, operatorActor(context), new Date()))) {
      throw new NotFoundException('Command batch was not found in the active Branch');
    }
    const batch = await this.batch(batchId, context);
    if (!batch) {
      throw new NotFoundException('Command batch was not found in the active Branch');
    }
    return batch;
  }

  async find(id: string, context: RequestContext): Promise<ErmCommandRequest | null> {
    const scope = operatorScope(context);
    const request = await this.repository.findById(scope, auditId(id));
    if (!request) {
      return null;
    }
    await this.fleet.deviceImei(request.deviceId, context);
    return commandRequestView(request, await this.repository.related(scope, [request]), context);
  }

  async deviceRequests(device: DeviceReference, context: RequestContext) {
    const scope = operatorScope(context);
    const request = device.telemetryRequest;
    const deviceIds = request.deviceIds.length ? request.deviceIds : [auditId(device.id)];
    request.commandRequests ??= this.repository.history(scope, deviceIds).then(async (rows) => {
      const related = await this.repository.related(scope, rows);
      return new Map(
        deviceIds.map((id) => [
          id,
          rows
            .filter((row) => row.deviceId === id)
            .map((row) => commandRequestView(row, related, context)),
        ]),
      );
    });
    return (await request.commandRequests).get(device.id) ?? [];
  }

  tick(): Promise<void> {
    if (this.running) {
      return this.running;
    }
    const work = this.dispatch().finally(() => {
      this.running = undefined;
    });
    this.running = work;
    return work;
  }

  private async dispatch(): Promise<void> {
    const now = new Date();
    await this.repository.expire(now);
    let primary: Set<string>;
    try {
      primary = new Set(
        (await this.devices.listUnits())
          .filter((unit) => unit.mode === 'primary')
          .map((unit) => unit.unitId),
      );
    } catch {
      await this.repository.gatewayWaiting(null, now);
      return;
    }
    await this.repository.gatewayWaiting([...primary], now);
    if (!primary.size) {
      return;
    }
    const pending = await this.repository.pending(now, [...primary]);
    for (const request of pending) {
      if (!primary.has(request.unitId)) {
        continue;
      }
      try {
        this.workflows.acquire(request.unitId);
      } catch (error) {
        if (error instanceof ConflictException) {
          continue;
        }
        throw error;
      }
      try {
        let matches: boolean;
        try {
          matches = await this.fleet.matchesDeviceTarget({
            tenantId: request.tenantId,
            branchId: request.branchId,
            deviceId: request.deviceId,
            imei: request.unitId,
          });
        } catch {
          await this.repository.waiting(request.id, 'FLEET_VERIFICATION_UNAVAILABLE', new Date());
          continue;
        }
        if (!matches) {
          await this.repository.rejectTarget(request.id, new Date());
          continue;
        }
        if (!(await this.repository.claim(request.id, new Date()))) {
          continue;
        }
        try {
          const result = await this.devices.sendCommand(
            request.unitId,
            validateCommand(deviceActions[request.action]),
          );
          const accepted =
            result.status === 'answered' &&
            (result.resultCode === null || result.resultCode === '01');
          await this.repository.finish(request.id, {
            status: result.status === 'answered' ? (accepted ? 'ANSWERED' : 'FAILED') : 'UNCERTAIN',
            completedAt: new Date(),
            commandId: result.id,
            resultCode: result.resultCode,
            responseText: result.fields.length ? result.fields.join(',') : null,
            failureReason: accepted
              ? null
              : result.status === 'answered'
                ? `The unit rejected the command (result ${result.resultCode ?? 'unknown'})`
                : 'The unit did not confirm the command; it may have reached the unit and will not be replayed',
          });
        } catch (error) {
          await this.repository.finish(request.id, {
            status: error instanceof ConflictException ? 'FAILED' : 'UNCERTAIN',
            completedAt: new Date(),
            failureReason:
              error instanceof ConflictException
                ? 'The gateway refused submission because the unit is not primary or is busy'
                : 'Gateway submission failed or timed out; outcome is unknown and will not be replayed',
          });
        }
      } finally {
        this.workflows.release(request.unitId);
      }
    }
  }
}
