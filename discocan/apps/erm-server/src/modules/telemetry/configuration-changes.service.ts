import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  StartErmEdataChangeInput,
  StartErmParameterChangeInput,
  StartErmParametersChangeInput,
  StartErmParameterBatchInput,
  ErmConfigurationBatch,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  runEdataChange,
  runParameterChange,
  runParametersChange,
  validateEdataChangeOptions,
  validateParameterChangeOptions,
  validateParametersChangeOptions,
  type EdataChangeOptions,
  type ParameterChangeOptions,
  type ParametersChangeOptions,
} from './edata-change.js';
import { EdataChangeRepository, type EdataChangeStep } from './edata-change.repository.js';
import { FleetClient } from './fleet.client.js';
import { LiveDevicesService } from './live-devices.service.js';
import { ParameterSnapshotsService } from './parameter-snapshots.service.js';
import type { DeviceReference } from './telemetry.service.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';
import { auditId, operatorAudit, operatorScope, type OperatorAudit } from './operator-audit.js';
import { commandView } from './command-evidence.js';
import { ConfigurationBatchesRepository } from './configuration-batches.repository.js';
import { commandDeviceIds } from './command-requests.query.js';
import { requireEngineer, requireOperator } from './operator-roles.js';
import type { ErmConfigurationOperation } from '../../generated/prisma/client.js';
import { operatorActor } from './operator-audit.js';
import { configurationChangeView } from './configuration-change-view.js';

type ConfigurationOptions = EdataChangeOptions | ParameterChangeOptions | ParametersChangeOptions;

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
  private readonly batches: ConfigurationBatchesRepository;
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
    this.batches = new ConfigurationBatchesRepository(prisma.client);
  }

  async onModuleInit(): Promise<void> {
    await this.repository.interruptUnfinished(new Date());
    await this.batches.interrupt(new Date());
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.jobs);
  }

  writesEnabled(context: RequestContext): boolean {
    requireTenant(context);
    return (
      (context.role === 'ENGINEER' || context.role === 'ADMINISTRATOR') &&
      configurationWritesEnabled()
    );
  }

  async startEdata(input: StartErmEdataChangeInput, context: RequestContext) {
    if (input.read === true) {
      requireOperator(context);
    } else {
      requireEngineer(context);
    }
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
    requireEngineer(context);
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

  async startParameters(input: StartErmParametersChangeInput, context: RequestContext) {
    requireEngineer(context);
    const unitId = await this.fleet.deviceImei(input.deviceId, context);
    const options = this.parametersOptions(input, unitId);
    return this.start(options, context, input.deviceId);
  }

  private parametersOptions(
    input: Pick<StartErmParametersChangeInput, 'parameters' | 'restoreAfter'>,
    unitId: string,
  ): ParametersChangeOptions {
    const options = {
      unitId,
      parameters: input.parameters,
      restoreAfter: input.restoreAfter ?? false,
    };
    try {
      validateParametersChangeOptions(options);
    } catch {
      throw new BadRequestException(
        'Choose an explicit set of unique writable catalog parameters; routing and protected parameters are refused',
      );
    }
    return options;
  }

  async startBatch(input: StartErmParameterBatchInput, context: RequestContext) {
    requireEngineer(context);
    if (!configurationWritesEnabled()) {
      throw new ForbiddenException('ERM configuration writes are disabled');
    }
    const deviceIds = commandDeviceIds(input.deviceIds);
    const units = await this.fleet.deviceImeis(deviceIds, context);
    const targets = deviceIds.map((deviceId) => {
      const unitId = units.get(deviceId);
      if (!unitId) {
        throw new NotFoundException('Fleet device not found in the active Branch');
      }
      const options = this.parametersOptions(input, unitId);
      return {
        options,
        audit: operatorAudit(
          context,
          deviceId,
          `${this.intent(options)}${options.restoreAfter ? '; restore baseline afterwards' : ''}`,
        ),
      };
    });
    const batch = await this.batches.create(targets);
    const job = this.runBatch(batch.id, targets, context)
      .catch(() => {
        this.logger.error('Configuration batch status could not be persisted');
      })
      .finally(() => {
        this.jobs.delete(job);
      });
    this.jobs.add(job);
    return this.batchView(batch, context);
  }

  async batch(id: string, context: RequestContext) {
    const batch = await this.batches.find(operatorScope(context), auditId(id));
    return batch ? this.batchView(batch, context) : null;
  }

  async stopBatch(id: string, context: RequestContext) {
    requireEngineer(context);
    const scope = operatorScope(context);
    id = auditId(id);
    if (!(await this.batches.find(scope, id))) {
      throw new NotFoundException('Configuration batch not found in the active Branch');
    }
    await this.batches.stop(scope, id, operatorActor(context));
    return this.batch(id, context);
  }

  private batchView(
    batch: NonNullable<Awaited<ReturnType<ConfigurationBatchesRepository['find']>>>,
    context: RequestContext,
  ): ErmConfigurationBatch {
    return {
      ...batch,
      changes: batch.configurationChanges.map((change) =>
        configurationChangeView(change, new Map(), context),
      ),
    };
  }

  private async runBatch(
    id: string,
    targets: { audit: OperatorAudit; options: ParametersChangeOptions }[],
    context: RequestContext,
  ): Promise<void> {
    const scope = operatorScope(context);
    try {
      for (const [index, target] of targets.entries()) {
        const batch = await this.batches.find(scope, id);
        const change = batch?.configurationChanges[index];
        if (!batch || batch.stoppedAt || !change) {
          break;
        }
        let acquired = false;
        try {
          if (!configurationWritesEnabled()) {
            throw new ForbiddenException('ERM configuration writes are disabled');
          }
          const unitId = await this.fleet.deviceImei(target.audit.deviceId, context);
          if (unitId !== target.options.unitId) {
            throw new ConflictException('Fleet Device ownership or IMEI changed before submission');
          }
          await this.requirePrimary(unitId);
          this.workflows.acquire(unitId);
          acquired = true;
          await this.requireReconciled(target.options);
          await this.run(change.id, target.options, false, target.audit);
        } catch (error) {
          if (
            error instanceof ConflictException ||
            error instanceof ForbiddenException ||
            error instanceof NotFoundException
          ) {
            await this.repository.save(change.id, [], {
              status: 'REFUSED',
              finishedAt: new Date(),
              failureReason: error.message,
            });
          } else {
            await this.repository.interruptUnfinished(new Date(), change.id);
          }
        } finally {
          if (acquired) {
            this.workflows.release(target.options.unitId);
          }
        }
        const current = await this.batches.find(scope, id);
        if (current?.configurationChanges[index]?.status !== 'VERIFIED') {
          break;
        }
      }
    } finally {
      await this.batches.finish(scope, id);
    }
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
              .map((change) => configurationChangeView(change, commands, context)),
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

  private async start(options: ConfigurationOptions, context: RequestContext, deviceId: string) {
    requireTenant(context);
    const read = 'read' in options && options.read;
    if (!read && !configurationWritesEnabled()) {
      throw new ForbiddenException('ERM configuration writes are disabled');
    }
    await this.requirePrimary(options.unitId);
    this.workflows.acquire(options.unitId);
    try {
      if (!read) {
        await this.requireReconciled(options);
      }
      const parameters = this.parameterNumbers(options);
      const parameter =
        'parameters' in options
          ? null
          : 'value' in options
            ? Number(options.parameter)
            : (options.parameter ??
              (options.add ? Number.parseInt(options.add.slice(0, 4), 16) : null));
      const intent = this.intent(options);
      const audit = operatorAudit(
        context,
        deviceId,
        `${intent}${options.restoreAfter ? '; restore baseline afterwards' : ''}`,
      );
      const change = await this.repository.create(
        options.unitId,
        parameter,
        this.operation(options),
        audit,
        parameters,
      );
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
      return configurationChangeView(change, new Map(), context);
    } catch (error) {
      this.workflows.release(options.unitId);
      throw error;
    }
  }

  private parameterNumbers(options: ConfigurationOptions): number[] {
    return 'parameters' in options
      ? options.parameters.map(({ parameter }) => Number(parameter))
      : 'value' in options
        ? [Number(options.parameter)]
        : [];
  }

  private operation(options: ConfigurationOptions): ErmConfigurationOperation {
    return 'parameters' in options
      ? 'PARAMETERS'
      : 'value' in options
        ? 'PARAMETER'
        : options.read
          ? 'READ_EDATA'
          : options.globals
            ? 'GLOBALS'
            : options.add
              ? 'ADD_DEFINITION'
              : 'INTERVAL';
  }

  private intent(options: ConfigurationOptions): string {
    if ('parameters' in options) {
      return `Set parameters ${options.parameters.map(({ parameter }) => parameter).join(', ')}`;
    }
    if ('value' in options) {
      return `Set parameter ${options.parameter}`;
    }
    if (options.read) {
      return 'Read eData configuration';
    }
    if (options.globals) {
      return 'Set eData globals 302';
    }
    const parameter =
      options.parameter ?? (options.add ? Number.parseInt(options.add.slice(0, 4), 16) : null);
    return options.add
      ? `Add eData parameter ${String(parameter)}`
      : `Set eData parameter ${String(parameter)} interval to ${String(options.interval)} seconds`;
  }

  private async requireReconciled(options: ConfigurationOptions): Promise<void> {
    const parameters = this.parameterNumbers(options);
    if (
      await this.repository.needsFreshRead(
        options.unitId,
        parameters.length ? parameters : undefined,
      )
    ) {
      throw new ConflictException(
        parameters.length
          ? 'A previous submission is UNCERTAIN; take a fresh read of these parameters'
          : 'A previous submission is UNCERTAIN; take a fresh eData read',
      );
    }
  }

  private async run(
    id: string,
    options: ConfigurationOptions,
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
    if ('parameters' in options) {
      await runParametersChange(this.prisma.client, options, runtime);
    } else if ('value' in options) {
      await runParameterChange(this.prisma.client, options, runtime);
    } else {
      await runEdataChange(this.prisma.client, options, runtime);
    }
  }
}
