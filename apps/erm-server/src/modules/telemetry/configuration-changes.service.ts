import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  StartErmEdataChangeInput,
  StartErmParameterChangeInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  runEdataChange,
  runParameterChange,
  validateEdataChangeOptions,
  validateParameterChangeOptions,
  type EdataChangeOptions,
  type ParameterChangeOptions,
} from './edata-change.js';
import { EdataChangeRepository, type EdataChangeStep } from './edata-change.repository.js';
import { FleetClient } from './fleet.client.js';
import { LiveDevicesService } from './live-devices.service.js';
import { ParameterSnapshotsService } from './parameter-snapshots.service.js';
import type { DeviceReference } from './telemetry.service.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';
import { auditId, operatorAudit, operatorScope, type OperatorAudit } from './operator-audit.js';
import { commandView } from './command-evidence.js';
import { configurationChangeView } from './configuration-change-view.js';

export function configurationWritesEnabled(): boolean {
  const value = process.env.ERM_CONFIGURATION_WRITES_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('ERM_CONFIGURATION_WRITES_ENABLED must be true or false');
  }
  return value === 'true';
}

@Injectable()
export class ConfigurationChangesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfigurationChangesService.name);
  private readonly repository: EdataChangeRepository;
  private readonly jobs = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: LiveDevicesService,
    private readonly fleet: FleetClient,
    private readonly snapshots: ParameterSnapshotsService,
    private readonly workflows: UnitWorkflowsService,
  ) {
    configurationWritesEnabled();
    this.repository = new EdataChangeRepository(prisma.client);
  }

  async onModuleInit(): Promise<void> {
    await this.repository.interruptUnfinished(new Date());
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.jobs);
  }

  writesEnabled(context: RequestContext): boolean {
    requireTenant(context);
    return configurationWritesEnabled();
  }

  async startEdata(input: StartErmEdataChangeInput, context: RequestContext) {
    requireTenant(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    const options: EdataChangeOptions = {
      unitId,
      ...(input.read == null ? {} : { read: input.read }),
      ...(input.parameterId == null ? {} : { parameter: input.parameterId }),
      ...(input.intervalSeconds == null ? {} : { interval: input.intervalSeconds }),
      ...(input.definitionHex == null ? {} : { add: input.definitionHex }),
      ...(input.globalsHex == null ? {} : { globals: input.globalsHex }),
      restoreAfter: input.restoreAfter ?? false,
    };
    try {
      validateEdataChangeOptions(options);
    } catch {
      throw new BadRequestException(
        'Choose one eData read, interval change, single definition or globals value',
      );
    }
    return this.start(options, context, input.deviceId);
  }

  async startParameter(input: StartErmParameterChangeInput, context: RequestContext) {
    requireTenant(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    const options: ParameterChangeOptions = {
      unitId,
      parameter: input.parameter,
      value: input.value,
      restoreAfter: input.restoreAfter ?? false,
    };
    try {
      validateParameterChangeOptions(options);
    } catch {
      throw new BadRequestException(
        'Choose a writable four-digit catalog parameter; routing and protected parameters are refused',
      );
    }
    return this.start(options, context, input.deviceId);
  }

  async deviceChanges(device: DeviceReference, context: RequestContext) {
    const scope = operatorScope(context);
    const request = device.telemetryRequest;
    const deviceIds = request.deviceIds.length ? request.deviceIds : [auditId(device.id)];
    request.configurationChanges ??= this.repository
      .history(scope, deviceIds, this.prisma.schema)
      .then(async (changes) => {
        const commands = new Map(
          (await this.repository.commands(changes)).map((command) => [
            command.id,
            commandView(command),
          ]),
        );
        return new Map(
          deviceIds.map((deviceId) => [
            deviceId,
            changes
              .filter((change) => change.deviceId === deviceId)
              .map((change) => configurationChangeView(change, commands)),
          ]),
        );
      });
    return (await request.configurationChanges).get(device.id) ?? [];
  }

  private async requirePrimary(unitId: string): Promise<void> {
    if (
      !(await this.devices.listUnits()).some(
        (unit) => unit.unitId === unitId && unit.mode === 'primary',
      )
    ) {
      throw new ConflictException('Unit is not connected in primary mode');
    }
  }

  private async start(
    options: EdataChangeOptions | ParameterChangeOptions,
    context: RequestContext,
    deviceId: string,
  ) {
    requireTenant(context);
    const read = 'read' in options && options.read;
    if (!read && !configurationWritesEnabled()) {
      throw new ForbiddenException('ERM configuration writes are disabled');
    }
    await this.requirePrimary(options.unitId);
    this.workflows.acquire(options.unitId);
    try {
      if (!read && (await this.repository.needsFreshRead(options.unitId))) {
        throw new ConflictException('A previous submission is UNCERTAIN; take a fresh eData read');
      }
      const parameter =
        'value' in options
          ? Number(options.parameter)
          : (options.parameter ??
            (options.add ? Number.parseInt(options.add.slice(0, 4), 16) : null));
      const intent =
        'value' in options
          ? `Set parameter ${options.parameter}`
          : read
            ? 'Read eData configuration'
            : options.globals
              ? 'Set eData globals 302'
              : options.add
                ? `Add eData parameter ${String(parameter)}`
                : `Set eData parameter ${String(parameter)} interval to ${String(options.interval)} seconds`;
      const audit = operatorAudit(
        context,
        deviceId,
        `${intent}${options.restoreAfter ? '; restore baseline afterwards' : ''}`,
      );
      const change = await this.repository.create(options.unitId, parameter, audit);
      const job = this.run(change.id, options, read, audit)
        .catch(async () => {
          await this.repository.interruptUnfinished(new Date(), change.id);
        })
        .catch(() => {
          this.logger.error('Configuration operation status could not be persisted');
        })
        .finally(() => {
          this.workflows.release(options.unitId);
          this.jobs.delete(job);
        });
      this.jobs.add(job);
      return configurationChangeView(change);
    } catch (error) {
      this.workflows.release(options.unitId);
      throw error;
    }
  }

  private async run(
    id: string,
    options: EdataChangeOptions | ParameterChangeOptions,
    read: boolean,
    audit: OperatorAudit,
  ): Promise<void> {
    const steps: EdataChangeStep[] = [];
    if (!read) {
      steps.push({
        name: 'parameter-snapshot',
        commandId: null,
        time: new Date().toISOString(),
        outcome: 'REQUESTING',
      });
      await this.repository.save(id, steps);
      const snapshot = await this.snapshots.captureForConfiguration(options.unitId, audit);
      steps.push({
        name: 'parameter-snapshot',
        commandId: null,
        time: new Date().toISOString(),
        outcome: snapshot.complete ? 'COMPLETE' : 'FAILED',
        payload: snapshot.id,
      });
      await this.repository.save(id, steps);
      if (!snapshot.complete) {
        await this.repository.save(id, steps, {
          status: 'REFUSED',
          finishedAt: new Date(),
          failureReason: 'A complete parameter snapshot is required before a configuration write',
        });
        return;
      }
    }
    const runtime = {
      gateway: this.devices,
      changeId: id,
      initialSteps: steps,
      log: () => undefined,
    };
    if ('value' in options) {
      await runParameterChange(this.prisma.client, options, runtime);
    } else {
      await runEdataChange(this.prisma.client, options, runtime);
    }
  }
}
