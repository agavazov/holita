import { setTimeout } from 'node:timers/promises';
import type {
  ErmConfigurationChangeStatus,
  ErmConfigurationOperation,
  PrismaClient,
} from '../../generated/prisma/client.js';
import {
  assembleEdataConfiguration,
  type EdataConfiguration,
  type EdataConfigurationObservation,
} from '../../starlink/edata-configuration.js';
import { parameterCatalog } from '../../starlink/parameter-catalog.js';
import { validateCommand, type DeviceCommand } from '../devices/command.js';
import { EdataChangeRepository, type EdataChangeStep } from './edata-change.repository.js';
import { LiveDevicesService } from './live-devices.service.js';

export interface EdataChangeOptions {
  unitId: string;
  read?: boolean;
  parameter?: number;
  interval?: number;
  add?: string;
  globals?: string;
  restoreAfter?: boolean;
}

export interface ParameterChangeOptions {
  unitId: string;
  parameter: string;
  value: string;
  restoreAfter?: boolean;
}

export interface ParametersChangeOptions {
  unitId: string;
  parameters: { parameter: string; value: string }[];
  restoreAfter?: boolean;
}

export function validateParametersChangeOptions(options: ParametersChangeOptions): void {
  if (
    options.parameters.length === 0 ||
    new Set(options.parameters.map(({ parameter }) => Number(parameter))).size !==
      options.parameters.length
  ) {
    throw new Error('Expected an explicit set of distinct writable parameters');
  }
  for (const parameter of options.parameters) {
    validateParameterChangeOptions({ unitId: options.unitId, ...parameter });
  }
  validateCommand({
    command: '46',
    fields: options.parameters.flatMap(({ parameter, value }) => [parameter, value]),
  });
}

interface ChangeRuntime {
  gateway?: LiveDevicesService;
  pollIntervalMs?: number;
  readTimeoutMs?: number;
  log?: (message: string) => void;
  changeId?: string;
  initialSteps?: EdataChangeStep[];
}

export function validateParameterChangeOptions(options: ParameterChangeOptions): void {
  const title = parameterCatalog.get(Number(options.parameter));
  if (
    !/^\d{15}$/.test(options.unitId) ||
    !/^\d{4}$/.test(options.parameter) ||
    title === undefined ||
    /\b(?:password|secret|lock|unlock|PIN)\b/i.test(title)
  ) {
    throw new Error('Expected a 15-digit unit and a writable four-digit catalog parameter');
  }
  // Reuse both guards: the read excludes all routing, and the write excludes protected values.
  validateCommand({ command: '03', fields: [options.parameter] });
  validateCommand({ command: '04', fields: [options.parameter, options.value] });
}

class Stopped extends Error {
  constructor(
    readonly status: ErmConfigurationChangeStatus,
    reason: string,
  ) {
    super(reason);
  }
}

function definitionsEqual(left: EdataConfiguration, right: EdataConfiguration): boolean {
  return (
    left.definitions.length === right.definitions.length &&
    left.definitions.every(
      (definition, index) => definition.definition === right.definitions[index]?.definition,
    )
  );
}

function edataCommand(payload: string, command = '301'): DeviceCommand {
  return validateCommand({
    command: '30',
    fields: ['19', '0', '19', command, '0', '1', '1', payload],
  });
}

export function validateEdataChangeOptions(options: EdataChangeOptions): void {
  const intervalChange = options.parameter !== undefined || options.interval !== undefined;
  if (
    !/^\d{15}$/.test(options.unitId) ||
    Number(options.read === true) +
      Number(options.add !== undefined) +
      Number(options.globals !== undefined) +
      Number(intervalChange) !==
      1 ||
    (options.read && options.restoreAfter) ||
    (options.add !== undefined && !/^[0-9a-f]{44}$/i.test(options.add)) ||
    (options.globals !== undefined && !/^[0-9a-f]{98}$/i.test(options.globals)) ||
    (intervalChange &&
      (options.parameter === undefined ||
        !Number.isInteger(options.parameter) ||
        options.parameter < 0 ||
        options.parameter > 65535 ||
        options.interval === undefined ||
        !Number.isInteger(options.interval) ||
        options.interval < 0 ||
        options.interval > 65000))
  ) {
    throw new Error(
      'Expected a 15-digit unit and exactly one of --read, --parameter with --interval, --add, or --globals',
    );
  }
}

// These operator-only workflows share the eData run record and command discipline.
export function runEdataChange(
  client: PrismaClient,
  options: EdataChangeOptions,
  runtime: ChangeRuntime = {},
) {
  validateEdataChangeOptions(options);
  return runConfigurationChange(client, options, runtime);
}

export function runParameterChange(
  client: PrismaClient,
  options: ParameterChangeOptions,
  runtime: ChangeRuntime = {},
) {
  validateParameterChangeOptions(options);
  return runConfigurationChange(client, options, runtime);
}

export function runParametersChange(
  client: PrismaClient,
  options: ParametersChangeOptions,
  runtime: ChangeRuntime = {},
) {
  validateParametersChangeOptions(options);
  return runConfigurationChange(client, options, runtime);
}

async function runConfigurationChange(
  client: PrismaClient,
  options: EdataChangeOptions | ParameterChangeOptions | ParametersChangeOptions,
  runtime: ChangeRuntime,
) {
  const repository = new EdataChangeRepository(client);
  const gateway = runtime.gateway ?? new LiveDevicesService();
  const log = runtime.log ?? console.info;
  const readTimeout = runtime.readTimeoutMs ?? 90_000;
  const pollInterval = runtime.pollIntervalMs ?? 500;
  const parameterOptions =
    'parameters' in options
      ? options.parameters
      : 'value' in options
        ? [{ parameter: options.parameter, value: options.value }]
        : undefined;
  const parameter =
    'parameters' in options
      ? null
      : 'value' in options
        ? Number(options.parameter)
        : (options.parameter ??
          (options.add ? Number.parseInt(options.add.slice(0, 4), 16) : null));
  const operation: ErmConfigurationOperation =
    'parameters' in options
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
  const change =
    runtime.changeId === undefined
      ? await repository.create(
          options.unitId,
          parameter,
          operation,
          undefined,
          parameterOptions?.map(({ parameter }) => Number(parameter)) ?? [],
        )
      : { id: runtime.changeId };
  const steps: EdataChangeStep[] = [...(runtime.initialSteps ?? [])];
  let phase = 'connected';
  let session: { connectedSince: string; peer: string } | undefined;

  async function record(step: EdataChangeStep): Promise<void> {
    steps.push(step);
    await repository.save(change.id, steps);
    log(`${step.name}: ${step.outcome}${step.payload === undefined ? '' : `; ${step.payload}`}`);
  }

  async function finish(status: ErmConfigurationChangeStatus, failureReason: string | null = null) {
    log(`result: ${status}${failureReason === null ? '' : `; ${failureReason}`}`);
    return repository.save(change.id, steps, { status, failureReason, finishedAt: new Date() });
  }

  async function requirePrimary(): Promise<void> {
    const units = await gateway.listUnits();
    const unit = units.find((unit) => unit.unitId === options.unitId && unit.mode === 'primary');
    if (!unit) {
      throw new Stopped('REFUSED', 'Unit is not connected in primary mode');
    }
    if (session && (unit.connectedSince !== session.connectedSince || unit.peer !== session.peer)) {
      throw new Stopped('REFUSED', 'Unit session changed; start a new operation');
    }
    session = unit;
  }

  async function read<T>(
    name: string,
    command: DeviceCommand,
    assemble: (rows: EdataConfigurationObservation[]) => T | undefined,
  ): Promise<{ value: T; commandId: string; requestedAt: Date }> {
    phase = name;
    await requirePrimary();
    const after = await repository.watermark(options.unitId);
    const requestedAt = new Date();
    await record({ name, commandId: null, time: requestedAt.toISOString(), outcome: 'REQUESTING' });
    const result = await gateway.sendCommand(options.unitId, command);
    await record({
      name,
      commandId: result.id,
      time: new Date().toISOString(),
      outcome: result.status.toUpperCase(),
    });
    if (
      result.status !== 'answered' ||
      (result.resultCode !== null && result.resultCode !== '01')
    ) {
      throw new Stopped('FAILED', `${name} read was not accepted`);
    }
    const deadline = requestedAt.getTime() + readTimeout;
    do {
      const value = assemble(await repository.observations(options.unitId, after, requestedAt));
      if (value !== undefined) {
        return { value, commandId: result.id, requestedAt };
      }
      await setTimeout(pollInterval);
    } while (Date.now() < deadline);
    throw new Stopped('FAILED', `${name} readback is incomplete or conflicting`);
  }

  async function readConfiguration(name: string) {
    const result = await read(name, edataCommand('0702BC'), assembleEdataConfiguration);
    await record({
      name,
      commandId: result.commandId,
      time: new Date().toISOString(),
      outcome: 'COMPLETE',
      configuration: result.value,
    });
    return result;
  }

  async function write(name: string, command: DeviceCommand, preflightAt?: Date): Promise<void> {
    phase = name;
    await requirePrimary();
    // Persist the ambiguity before sending. An interrupted process must never replay this write.
    steps.push({
      name,
      commandId: null,
      time: new Date().toISOString(),
      outcome: 'SUBMITTING',
      ...(command.fields[3] === '302' && { payload: command.fields[7] }),
    });
    await repository.save(change.id, steps, {
      status: 'UNCERTAIN',
      failureReason: parameterOptions
        ? 'Submission outcome is unknown; read the affected parameters before another write'
        : 'Submission outcome is unknown; take a fresh eData read',
    });
    if (preflightAt && Date.now() - preflightAt.getTime() > 120_000) {
      throw new Stopped('REFUSED', 'Preflight is older than 120 seconds');
    }
    let result: Awaited<ReturnType<LiveDevicesService['sendCommand']>>;
    try {
      result =
        command.command === '30' && command.fields[3] === '302'
          ? await gateway.sendGlobalsChange(options.unitId, change.id)
          : await gateway.sendCommand(options.unitId, command);
    } catch {
      throw new Stopped(
        'UNCERTAIN',
        `${name} submission failed or timed out; ${parameterOptions ? 'read the affected parameters before another write' : 'take a fresh eData read'}`,
      );
    }
    await record({
      name,
      commandId: result.id,
      time: new Date().toISOString(),
      outcome:
        result.status === 'answered'
          ? result.resultCode === '01'
            ? 'ANSWERED 01'
            : `ANSWERED REJECTED ${result.resultCode ?? 'unknown'}`
          : result.status.toUpperCase(),
    });
    if (result.status !== 'answered') {
      throw new Stopped(
        'UNCERTAIN',
        `${name} submission failed or timed out; ${parameterOptions ? 'read the affected parameters before another write' : 'take a fresh eData read'}`,
      );
    }
    if (result.resultCode !== '01') {
      throw new Stopped(
        'FAILED',
        `${name} was rejected by the unit (result ${result.resultCode ?? 'unknown'})`,
      );
    }
  }

  async function valueStep(name: string, payload: string, outcome = 'COMPLETE') {
    await record({ name, commandId: null, time: new Date().toISOString(), outcome, payload });
  }

  async function readGlobals(name: string) {
    const result = await read(name, edataCommand('', '303'), (rows) => {
      const reports = rows.filter(
        ({ fields }) => fields[0] === '19' && fields[1] === '0' && fields[2] === '410',
      );
      const fields = reports.length === 1 ? reports[0]?.fields : undefined;
      const payload = fields?.[7];
      return fields?.length === 8 &&
        fields[3] === '0' &&
        fields[4] === '1' &&
        fields[5] === '1' &&
        payload !== undefined &&
        /^[0-9a-f]{98}$/i.test(payload)
        ? payload.toUpperCase()
        : undefined;
    });
    await record({
      name,
      commandId: result.commandId,
      time: new Date().toISOString(),
      outcome: 'COMPLETE',
      payload: result.value,
    });
    return result;
  }

  try {
    if (
      !('read' in options && options.read) &&
      (await repository.needsFreshRead(
        options.unitId,
        parameterOptions?.map(({ parameter }) => Number(parameter)),
      ))
    ) {
      throw new Stopped(
        'REFUSED',
        parameterOptions
          ? 'A previous submission is UNCERTAIN; read the affected parameters before another write'
          : 'A previous submission is UNCERTAIN; take a fresh eData read',
      );
    }
    if ('parameters' in options || 'value' in options) {
      const requestedParameters =
        'parameters' in options
          ? options.parameters
          : [{ parameter: options.parameter, value: options.value }];
      const multiple = 'parameters' in options;
      const unquoted = (value: string) =>
        value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
      const targets = requestedParameters.map(({ parameter, value }) => ({
        parameter,
        value: unquoted(value),
      }));
      const payload = (values: typeof targets) =>
        multiple ? JSON.stringify(values) : (values[0]?.value ?? '');
      const equal = (left: typeof targets, right: typeof targets) =>
        left.every(
          (entry, index) =>
            entry.parameter === right[index]?.parameter && entry.value === right[index].value,
        );
      async function readParameters(name: string) {
        phase = name;
        await requirePrimary();
        const requestedAt = new Date();
        const result = await gateway.sendCommand(
          options.unitId,
          validateCommand({
            command: multiple ? '45' : '03',
            fields: requestedParameters.map(({ parameter }) => parameter),
          }),
        );
        await record({
          name,
          commandId: result.id,
          time: new Date().toISOString(),
          outcome: result.status.toUpperCase(),
        });
        const values = new Map<number, string>();
        if (
          result.status === 'answered' &&
          result.resultCode === null &&
          result.fields.length === requestedParameters.length * 2
        ) {
          for (let index = 0; index < result.fields.length; index += 2) {
            const parameter = result.fields[index];
            const raw = result.fields[index + 1];
            if (
              parameter !== undefined &&
              /^\d{1,4}$/.test(parameter) &&
              raw !== undefined &&
              !values.has(Number(parameter))
            ) {
              values.set(Number(parameter), unquoted(raw));
            }
          }
        }
        const captured = requestedParameters.map(({ parameter }) => ({
          parameter,
          value: values.get(Number(parameter)),
        }));
        const complete: { parameter: string; value: string }[] = [];
        for (const entry of captured) {
          if (entry.value === undefined) {
            throw new Stopped('FAILED', `${name} parameter set is unread or incomplete`);
          }
          // Captured values must pass the same guards before they can be restored.
          validateParameterChangeOptions({
            unitId: options.unitId,
            parameter: entry.parameter,
            value: entry.value,
          });
          complete.push({ parameter: entry.parameter, value: entry.value });
        }
        await valueStep(name, payload(complete));
        return { values: complete, requestedAt };
      }
      const baseline = await readParameters('before');
      const storedBaseline = multiple ? { parameters: baseline.values } : baseline.values[0];
      await repository.save(change.id, steps, {
        ...(storedBaseline === undefined ? {} : { baseline: storedBaseline }),
        intended: payload(targets),
      });
      await valueStep('expected', payload(targets));
      if (equal(baseline.values, targets)) {
        return await finish('VERIFIED', 'Parameters already equal the target; no write');
      }
      let preflight = baseline;
      if (multiple) {
        preflight = await readParameters('preflight');
        if (!equal(baseline.values, preflight.values)) {
          throw new Stopped('REFUSED', 'Preflight differs from the baseline');
        }
      }
      async function writeParameters(name: string, values: typeof targets, preflightAt?: Date) {
        await valueStep(name === 'write' ? 'written' : 'restore-written', payload(values));
        try {
          await write(
            name,
            validateCommand({
              command: multiple ? '46' : '04',
              fields: values.flatMap(({ parameter, value }) => [parameter, value]),
            }),
            preflightAt,
          );
        } catch (error) {
          if (error instanceof Stopped && error.status === 'UNCERTAIN') {
            // Observe once, but never repeat or restore an unconfirmed write.
            try {
              await readParameters('uncertain-readback');
            } catch {
              await record({
                name: 'uncertain-readback',
                commandId: null,
                time: new Date().toISOString(),
                outcome: 'UNREAD',
              });
            }
          }
          throw error;
        }
      }
      await writeParameters('write', targets, preflight.requestedAt);
      let after: Awaited<ReturnType<typeof readParameters>>;
      try {
        after = await readParameters('after');
      } catch {
        throw new Stopped(
          'UNCERTAIN',
          'Parameter write was accepted but readback is incomplete; read the affected parameters',
        );
      }
      const verified = equal(after.values, targets);
      await valueStep('readback', payload(after.values), verified ? 'VERIFIED' : 'MISMATCH');
      await repository.save(change.id, steps, {
        status: verified ? 'VERIFIED' : 'MISMATCH',
        failureReason: verified ? null : 'Readback differs from the expected value',
      });
      if (verified && !options.restoreAfter) {
        return await finish('VERIFIED');
      }
      await writeParameters('restore', baseline.values);
      let restored: Awaited<ReturnType<typeof readParameters>>;
      try {
        restored = await readParameters('restore-readback');
      } catch {
        throw new Stopped(
          'UNCERTAIN',
          'Parameter restoration was accepted but readback is incomplete; read the affected parameters',
        );
      }
      const matches = equal(restored.values, baseline.values);
      await valueStep(
        'restore-readback',
        payload(restored.values),
        matches ? 'RESTORED' : 'RESTORE_FAILED',
      );
      return await finish(
        matches ? 'RESTORED' : 'RESTORE_FAILED',
        matches ? null : 'Parameter restoration differs from the baseline',
      );
    }
    await requirePrimary();
    await record({
      name: phase,
      commandId: null,
      time: new Date().toISOString(),
      outcome: 'PRIMARY',
    });
    if (options.globals !== undefined) {
      const { value: baseline } = await readGlobals('before');
      const intended = options.globals.toUpperCase();
      const expected = intended;
      await repository.save(change.id, steps, { baseline: { globals: baseline }, intended });
      await valueStep('written', intended);
      await valueStep('expected', expected);
      if (baseline === expected) {
        await valueStep('after', baseline, 'UNCHANGED');
        return await finish('VERIFIED', 'Globals already equal the expected readback; no write');
      }
      await write('write', {
        command: '30',
        fields: ['19', '0', '19', '302', '0', '1', '1', intended],
      });
      const { value: after } = await readGlobals('after');
      const verified = after === expected;
      await valueStep('readback', after, verified ? 'VERIFIED' : 'MISMATCH');
      await repository.save(change.id, steps, {
        status: verified ? 'VERIFIED' : 'MISMATCH',
        failureReason: verified ? null : 'Readback differs from the expected value',
      });
      if (verified && !options.restoreAfter) {
        return await finish('VERIFIED');
      }
      const restore = baseline;
      await valueStep('restore-written', restore);
      await write('restore', {
        command: '30',
        fields: ['19', '0', '19', '302', '0', '1', '1', restore],
      });
      const { value: restored } = await readGlobals('restore-readback');
      await valueStep(
        'restore-readback',
        restored,
        restored === baseline ? 'RESTORED' : 'RESTORE_FAILED',
      );
      return await finish(
        restored === baseline ? 'RESTORED' : 'RESTORE_FAILED',
        restored === baseline ? null : 'Globals restoration differs from the baseline',
      );
    }
    const { value: baseline } = await readConfiguration('baseline');
    await repository.save(change.id, steps, { baseline });
    if (options.read) {
      log(`definitions: ${JSON.stringify(baseline.definitions)}`);
      for (const [name, command, reportType] of [
        ['globals', '303', '410'],
        ['profile', '301', '416'],
      ] as const) {
        const result = await read(
          name,
          edataCommand(reportType === '410' ? '' : '1F', command),
          (rows) => {
            const reports = rows.filter(
              ({ fields }) => fields[0] === '19' && fields[1] === '0' && fields[2] === reportType,
            );
            if (reports.length !== 1) {
              return undefined;
            }
            const fields = reports[0]?.fields;
            const payload = fields?.[7];
            return fields?.length === 8 &&
              fields[3] === '0' &&
              fields[4] === '1' &&
              fields[5] === '1' &&
              payload !== undefined &&
              /^(?:[0-9a-f]{2})+$/i.test(payload) &&
              (reportType !== '416' || /^1F[0-9a-f]{4}$/i.test(payload))
              ? payload.toUpperCase()
              : undefined;
          },
        );
        await record({
          name,
          commandId: result.commandId,
          time: new Date().toISOString(),
          outcome: 'COMPLETE',
          payload: result.value,
        });
        log(
          `${name === 'globals' ? '410 globals' : '416 profile ID'}: ${name === 'globals' ? result.value : String(Number.parseInt(result.value.slice(2), 16))}`,
        );
      }
      return await finish('READ');
    }

    const existing = baseline.definitions.find((entry) => entry.parameter === parameter);
    if (options.add && existing) {
      throw new Stopped('REFUSED', 'Added parameter already exists in the baseline');
    }
    if (!options.add && !existing) {
      throw new Stopped('REFUSED', 'Parameter is absent from the baseline');
    }
    if (!options.add && existing?.interval === options.interval) {
      throw new Stopped('REFUSED', 'Reporting interval is unchanged');
    }
    let intended: string;
    let restorePayload: string;
    if (options.add) {
      intended = options.add.toUpperCase();
      restorePayload = `10${intended.slice(0, 4)}`;
    } else if (existing && options.interval !== undefined) {
      intended = `${existing.definition.slice(0, 40)}${options.interval.toString(16).padStart(4, '0').toUpperCase()}`;
      restorePayload = `02${existing.definition}`;
    } else {
      throw new Stopped('REFUSED', 'Parameter is absent from the baseline');
    }
    await repository.save(change.id, steps, { intended });
    const preflight = await readConfiguration('preflight');
    if (
      baseline.configurationId !== preflight.value.configurationId ||
      !definitionsEqual(baseline, preflight.value) ||
      Date.now() - preflight.requestedAt.getTime() > 120_000
    ) {
      throw new Stopped(
        'REFUSED',
        'Preflight differs from the baseline or is older than 120 seconds',
      );
    }
    await write('write', edataCommand(`02${intended}`), preflight.requestedAt);
    const expected = (definition: string): EdataConfiguration => ({
      ...baseline,
      definitions: [
        ...baseline.definitions.filter((entry) => entry.parameter !== parameter),
        {
          parameter: Number.parseInt(definition.slice(0, 4), 16),
          interval: Number.parseInt(definition.slice(40), 16),
          definition,
        },
      ].sort((left, right) => left.parameter - right.parameter),
    });
    // The unit may store an added definition's predefined multiplier/divisor 1/1 as 0/0
    // (parameter-reporting.md); that is the only accepted difference.
    const normalized =
      options.add && intended.slice(16, 24) === '00010001'
        ? `${intended.slice(0, 16)}00000000${intended.slice(24)}`
        : undefined;
    const readback = await readConfiguration('readback');
    const verified =
      definitionsEqual(expected(intended), readback.value) ||
      (normalized !== undefined && definitionsEqual(expected(normalized), readback.value));
    await record({
      name: 'readback',
      commandId: readback.commandId,
      time: new Date().toISOString(),
      outcome: verified ? 'VERIFIED' : 'MISMATCH',
      configuration: readback.value,
    });
    await repository.save(change.id, steps, {
      status: verified ? 'VERIFIED' : 'MISMATCH',
      failureReason: verified ? null : 'Readback differs from the intended whole set',
    });
    if (verified && !options.restoreAfter) {
      return await finish('VERIFIED');
    }
    // Addition deletion is reachable only here, after this row recorded an accepted write of an
    // ID absent from its own complete baseline. Existing definitions are always restored with 02.
    await write('restore', edataCommand(restorePayload));
    const restored = await readConfiguration('restore-readback');
    const matches = definitionsEqual(baseline, restored.value);
    await record({
      name: 'restore-readback',
      commandId: restored.commandId,
      time: new Date().toISOString(),
      outcome: matches ? 'RESTORED' : 'RESTORE_FAILED',
      configuration: restored.value,
    });
    return await finish(
      matches ? 'RESTORED' : 'RESTORE_FAILED',
      matches ? null : 'Restoration readback differs from the baseline',
    );
  } catch (error) {
    let status: ErmConfigurationChangeStatus = error instanceof Stopped ? error.status : 'FAILED';
    if (status !== 'UNCERTAIN' && (phase === 'restore' || phase === 'restore-readback')) {
      status = 'RESTORE_FAILED';
    } else if (phase === 'preflight') {
      status = 'REFUSED';
    }
    const reason =
      error instanceof Stopped
        ? error.message
        : 'ERM configuration operation failed; check gateway and database access';
    await record({ name: phase, commandId: null, time: new Date().toISOString(), outcome: status });
    return finish(status, reason);
  }
}
