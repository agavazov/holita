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
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { validateCommand } from '../devices/command.js';
import { CommandRequestsRepository } from './command-requests.repository.js';
import { commandRequestView } from './command-request-view.js';
import { deviceActions } from './device-actions.js';
import { FleetClient } from './fleet.client.js';
import { LiveDevicesService } from './live-devices.service.js';
import { auditId, operatorAudit, operatorScope } from './operator-audit.js';
import type { DeviceReference } from './telemetry.service.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';

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
    const scope = operatorScope(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    validateCommand(deviceActions[input.action]);
    const seconds = input.expiresInSeconds ?? 7200;
    const intent = input.intent?.trim() || input.action;
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400 || intent.length > 200) {
      throw new BadRequestException(
        'Command expiry must be 1–86400 seconds and intent at most 200 characters',
      );
    }
    const createdAt = new Date();
    const request = await this.repository.create(
      { ...operatorAudit(context, input.deviceId, intent), ...scope },
      unitId,
      input.action,
      createdAt,
      new Date(createdAt.getTime() + seconds * 1000),
    );
    return commandRequestView(request);
  }

  async cancel(
    input: CancelErmDeviceCommandInput,
    context: RequestContext,
  ): Promise<ErmCommandRequest> {
    const scope = operatorScope(context);
    await this.fleet.deviceImei(input.deviceId, context);
    const deviceId = auditId(input.deviceId),
      id = auditId(input.requestId);
    const request = await this.repository.find(scope, deviceId, id);
    if (!request) {
      throw new NotFoundException('Command request was not found in the active Branch');
    }
    if (!(await this.repository.cancel(scope, deviceId, id, new Date()))) {
      throw new ConflictException('Only queued requests can be cancelled');
    }
    const cancelled = await this.repository.find(scope, deviceId, id);
    if (!cancelled) {
      throw new NotFoundException('Command request was not found in the active Branch');
    }
    return commandRequestView(cancelled);
  }

  async find(id: string, context: RequestContext): Promise<ErmCommandRequest | null> {
    const scope = operatorScope(context);
    const request = await this.repository.findById(scope, auditId(id));
    if (!request) {
      return null;
    }
    await this.fleet.deviceImei(request.deviceId, context);
    return commandRequestView(request, await this.repository.related(scope, [request]));
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
          rows.filter((row) => row.deviceId === id).map((row) => commandRequestView(row, related)),
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
      return;
    }
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
