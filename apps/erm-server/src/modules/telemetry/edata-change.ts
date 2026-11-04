import { setTimeout } from 'node:timers/promises';
import type { ErmConfigurationChangeStatus, PrismaClient } from '../../generated/prisma/client.js';
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

interface ChangeRuntime {
  gateway?: LiveDevicesService;
  pollIntervalMs?: number;
  readTimeoutMs?: number;
  log?: (message: string) => void;
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

async function runConfigurationChange(
  client: PrismaClient,
  options: EdataChangeOptions | ParameterChangeOptions,
  runtime: ChangeRuntime,
) {
  const repository = new EdataChangeRepository(client);
  const gateway = runtime.gateway ?? new LiveDevicesService();
  const log = runtime.log ?? console.info;
  const readTimeout = runtime.readTimeoutMs ?? 90_000;
  const pollInterval = runtime.pollIntervalMs ?? 500;
  const parameter =
    'value' in options
      ? Number(options.parameter)
      : (options.parameter ?? (options.add ? Number.parseInt(options.add.slice(0, 4), 16) : null));
  const change = await repository.create(options.unitId, parameter);
  const steps: EdataChangeStep[] = [];
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
      failureReason:
        'value' in options
          ? 'Submission outcome is unknown; operator review required'
          : 'Submission outcome is unknown; take a fresh --read',
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
        `${name} submission failed or timed out; ${'value' in options ? 'operator review required' : 'take a fresh --read'}`,
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
            : 'ANSWERED REJECTED'
          : result.status.toUpperCase(),
    });
    if (result.status !== 'answered') {
      throw new Stopped(
        'UNCERTAIN',
        `${name} submission failed or timed out; ${'value' in options ? 'operator review required' : 'take a fresh --read'}`,
      );
    }
    if (result.resultCode !== '01') {
      throw new Stopped('FAILED', `${name} was rejected by the unit`);
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
    if ('value' in options) {
      const parameterOptions = options;
      const target =
        options.value.startsWith('"') && options.value.endsWith('"')
          ? options.value.slice(1, -1)
          : options.value;
      async function readParameter(name: string) {
        phase = name;
        await requirePrimary();
        const result = await gateway.sendCommand(
          parameterOptions.unitId,
          validateCommand({ command: '03', fields: [parameterOptions.parameter] }),
        );
        await record({
          name,
          commandId: result.id,
          time: new Date().toISOString(),
          outcome: result.status.toUpperCase(),
        });
        const raw = result.fields[1];
        if (
          result.status !== 'answered' ||
          result.resultCode !== null ||
          Number(result.fields[0]) !== Number(parameterOptions.parameter) ||
          result.fields.length !== 2 ||
          raw === undefined
        ) {
          throw new Stopped('FAILED', `${name} parameter is unread`);
        }
        const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
        // The same guards must accept the captured value before it can be used for restoration.
        validateParameterChangeOptions({ ...parameterOptions, value });
        await valueStep(name, value);
        return value;
      }
      const baseline = await readParameter('before');
      await repository.save(change.id, steps, {
        baseline: { parameter: parameterOptions.parameter, value: baseline },
        intended: target,
      });
      await valueStep('expected', target);
      if (baseline === target) {
        return await finish('VERIFIED', 'Parameter already equals the target; no write');
      }
      async function writeParameter(name: string, value: string) {
        await valueStep(name === 'write' ? 'written' : 'restore-written', value);
        try {
          await write(
            name,
            validateCommand({ command: '04', fields: [parameterOptions.parameter, value] }),
          );
        } catch (error) {
          if (error instanceof Stopped && error.status === 'UNCERTAIN') {
            // Observe once, but never repeat or restore an unconfirmed write.
            try {
              await readParameter('uncertain-readback');
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
      await writeParameter('write', target);
      const after = await readParameter('after');
      const verified = after === target;
      await valueStep('readback', after, verified ? 'VERIFIED' : 'MISMATCH');
      await repository.save(change.id, steps, {
        status: verified ? 'VERIFIED' : 'MISMATCH',
        failureReason: verified ? null : 'Readback differs from the expected value',
      });
      if (verified && !options.restoreAfter) {
        return await finish('VERIFIED');
      }
      await writeParameter('restore', baseline);
      const restored = await readParameter('restore-readback');
      await valueStep(
        'restore-readback',
        restored,
        restored === baseline ? 'RESTORED' : 'RESTORE_FAILED',
      );
      return await finish(
        restored === baseline ? 'RESTORED' : 'RESTORE_FAILED',
        restored === baseline ? null : 'Parameter restoration differs from the baseline',
      );
    }
    if (!options.read && (await repository.needsFreshRead(options.unitId))) {
      throw new Stopped('REFUSED', 'A previous submission is UNCERTAIN; take a fresh --read');
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
      // ERM's 302 export carries write-only 01 01 01 at bytes 11–13; 410 returns zeroes.
      const expected = `${intended.slice(0, 22)}000000${intended.slice(28)}`;
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
      const restore = `${baseline.slice(0, 22)}${intended.slice(22, 28)}${baseline.slice(28)}`;
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
