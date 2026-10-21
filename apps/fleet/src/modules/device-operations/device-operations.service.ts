import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetDeviceConfiguration,
  FleetDeviceOperation,
  RequestFleetDeviceConfigurationReadInput,
  RequestFleetDeviceParameterAdditionInput,
  RequestFleetDeviceParameterIntervalUpdateInput,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaDeviceReadsClient } from '../../integrations/karma/karma-device-reads.client.js';
import { integer, invalid, requireScope, text, uuid } from '../../validation.js';
import { configurationParameters } from './device-parameter-change.js';
import {
  DeviceOperationsRepository,
  type DeviceOperationRow,
} from './device-operations.repository.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configuration(row: DeviceOperationRow): FleetDeviceConfiguration | null {
  if (row.status !== 'COMPLETE' || !row.configurationId || !Array.isArray(row.configuration)) {
    return null;
  }
  const parameters = configurationParameters(row.configuration);
  return { configurationId: row.configurationId, parameters };
}

export function deviceOperationResult(row: DeviceOperationRow): FleetDeviceOperation {
  const evidence = record(row.observations) ? row.observations : {};
  return {
    id: row.id,
    deviceId: row.deviceId,
    deviceImei: row.deviceImei,
    karmaCarId: row.karmaCarId,
    karmaDeviceId: row.karmaDeviceId,
    status: row.status,
    kind: row.kind,
    phase: row.phase,
    baselineOperationId: row.baselineOperationId,
    parameterId: row.parameterId,
    intervalSeconds: row.intervalSeconds,
    previousIntervalSeconds: row.previousIntervalSeconds,
    catalogId: row.catalogId,
    profileId: row.profileId,
    writeDispatchedAt: row.writeDispatchedAt,
    writeUncertain: row.writeUncertain,
    requestedAt: row.requestedAt,
    dispatchedAt: row.dispatchedAt,
    completedAt: row.completedAt,
    nextCheckAt: row.nextCheckAt,
    deadlineAt: row.deadlineAt,
    queueIds: row.queueIds,
    observationCount:
      typeof evidence.count === 'number' && Number.isSafeInteger(evidence.count)
        ? evidence.count
        : 0,
    coverageComplete: evidence.coverageComplete === true,
    configuration: configuration(row),
    errorCode: row.errorCode,
  };
}

@Injectable()
export class DeviceOperationsService {
  constructor(
    private readonly operations: DeviceOperationsRepository,
    private readonly karma: KarmaDeviceReadsClient,
    private readonly clock: FleetClock,
  ) {}

  enabled(context: RequestContext): boolean {
    requireScope(context);
    return deviceOperationsEnabled();
  }

  writesEnabled(context: RequestContext): boolean {
    requireScope(context);
    return deviceConfigurationWritesEnabled();
  }

  presets(context: RequestContext) {
    requireScope(context);
    return this.operations.presets();
  }

  async requestAddition(
    context: RequestContext,
    input: RequestFleetDeviceParameterAdditionInput,
  ): Promise<FleetDeviceOperation> {
    return this.requestWrite(context, input, 'ADD_PARAMETER');
  }

  async requestIntervalUpdate(
    context: RequestContext,
    input: RequestFleetDeviceParameterIntervalUpdateInput,
  ): Promise<FleetDeviceOperation> {
    return this.requestWrite(context, input, 'UPDATE_INTERVAL');
  }

  private async requestWrite(
    context: RequestContext,
    input:
      RequestFleetDeviceParameterAdditionInput | RequestFleetDeviceParameterIntervalUpdateInput,
    kind: 'ADD_PARAMETER' | 'UPDATE_INTERVAL',
  ): Promise<FleetDeviceOperation> {
    const scope = requireScope(context);
    if (!deviceConfigurationWritesEnabled()) {
      throw new ServiceUnavailableException('Device configuration writing is disabled');
    }
    const deviceId = uuid(input.deviceId, 'deviceId');
    const baselineOperationId = uuid(input.baselineOperationId, 'baselineOperationId');
    const parameterId = integer(input.parameterId, 'parameterId', 0, 65535);
    const intervalSeconds = integer(input.intervalSeconds, 'intervalSeconds', 0, 65000);
    const karmaCarId = text(input.karmaCarId, 'karmaCarId', 16);
    if (!/^[1-9][0-9]*$/.test(karmaCarId) || !Number.isSafeInteger(Number(karmaCarId))) {
      invalid('karmaCarId', 'Use a valid Karma car ID.');
    }
    const expected = text(input.expectedKarmaDeviceId, 'expectedKarmaDeviceId', 128);
    const device = await this.operations.findDevice(scope, deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    const baseline = await this.operations.find(scope, baselineOperationId);
    if (
      !baseline ||
      baseline.status !== 'COMPLETE' ||
      baseline.deviceId !== deviceId ||
      baseline.deviceImei !== device.imei ||
      baseline.karmaCarId !== karmaCarId ||
      baseline.karmaDeviceId !== expected ||
      !baseline.configurationId
    ) {
      throw new ConflictException(
        'Read and confirm a complete configuration for the selected device and Karma target.',
      );
    }
    const parameters = configurationParameters(baseline.configuration);
    const previous = parameters.find((item) => item.parameterId === parameterId);
    let catalogId: string | null = null;
    if (kind === 'ADD_PARAMETER') {
      if (parameters.length >= 1000) {
        invalid('parameterId', 'The configuration has reached the supported readback capacity.');
      }
      if (!('catalogId' in input)) {
        invalid('catalogId', 'Choose a supported catalog preset.');
      }
      catalogId = uuid(input.catalogId, 'catalogId');
      const eligible = (await this.operations.presets()).some(
        (preset) => preset.catalogId === catalogId && preset.parameterId === parameterId,
      );
      if (!eligible) {
        invalid('parameterId', 'Choose an unambiguous predefined Monitor catalog parameter.');
      }
      if (previous) {
        throw new ConflictException('This parameter is already configured.');
      }
    } else {
      if (!previous) {
        throw new ConflictException('This parameter is absent from the confirmed configuration.');
      }
      if (previous.intervalSeconds === intervalSeconds) {
        invalid('intervalSeconds', 'Choose a different reporting interval.');
      }
    }
    const target = await this.karma.target(karmaCarId);
    if (target.deviceId !== expected) {
      throw new ConflictException('The Karma device target has changed.');
    }
    try {
      return deviceOperationResult(
        await this.operations.createWrite(
          scope,
          baseline,
          { kind, baselineOperationId, parameterId, intervalSeconds, catalogId },
          this.clock.now(),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A configuration operation for this Karma target is already active.',
        );
      }
      throw error;
    }
  }

  async find(context: RequestContext, id: string): Promise<FleetDeviceOperation | null> {
    const row = await this.operations.find(requireScope(context), uuid(id, 'id'));
    return row ? deviceOperationResult(row) : null;
  }

  async history(context: RequestContext, deviceId: string): Promise<FleetDeviceOperation[]> {
    const scope = requireScope(context);
    const id = uuid(deviceId, 'deviceId');
    if (!(await this.operations.findDevice(scope, id))) {
      throw new NotFoundException('Device not found');
    }
    return (await this.operations.history(scope, id)).map(deviceOperationResult);
  }

  async snapshot(context: RequestContext, deviceId: string): Promise<FleetDeviceOperation | null> {
    const scope = requireScope(context);
    const id = uuid(deviceId, 'deviceId');
    const device = await this.operations.findDevice(scope, id);
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    const row = await this.operations.lastComplete(scope, id, device.imei);
    return row ? deviceOperationResult(row) : null;
  }

  async request(
    context: RequestContext,
    input: RequestFleetDeviceConfigurationReadInput,
  ): Promise<FleetDeviceOperation> {
    const scope = requireScope(context);
    if (!deviceOperationsEnabled()) {
      throw new ServiceUnavailableException('Device configuration reading is disabled');
    }
    const deviceId = uuid(input.deviceId, 'deviceId');
    const karmaCarId = text(input.karmaCarId, 'karmaCarId', 16);
    if (!/^[1-9][0-9]*$/.test(karmaCarId) || !Number.isSafeInteger(Number(karmaCarId))) {
      invalid('karmaCarId', 'Use a valid Karma car ID.');
    }
    const expected = text(input.expectedKarmaDeviceId, 'expectedKarmaDeviceId', 128);
    const device = await this.operations.findDevice(scope, deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    const target = await this.karma.target(karmaCarId);
    if (target.deviceId !== expected) {
      throw new ConflictException('The Karma device target has changed.');
    }
    try {
      return deviceOperationResult(
        await this.operations.create(
          scope,
          {
            deviceId,
            deviceImei: device.imei,
            karmaCarId,
            karmaDeviceId: target.deviceId,
          },
          this.clock.now(),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A configuration read for this Karma target is already active.',
        );
      }
      throw error;
    }
  }
}

export function deviceOperationsEnabled(): boolean {
  const value = process.env.FLEET_DEVICE_OPERATIONS_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_DEVICE_OPERATIONS_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

export function deviceConfigurationWritesEnabled(): boolean {
  const value = process.env.FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED must be true or false');
  }
  return value === 'true' && deviceOperationsEnabled();
}
