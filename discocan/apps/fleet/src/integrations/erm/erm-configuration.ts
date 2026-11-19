import {
  parseDeviceConfigurationBatch,
  parseDeviceConfigurationChange,
  parseDeviceParameterDefinition,
  parseDeviceParameterDifference,
  parseDeviceParameterSnapshot,
  parseDeviceSnapshotValue,
  parseDeviceConfigurationHistory,
  parseDeviceConfigurationWritesEnabled,
  parseDeviceParameterCatalogPage,
  parseDeviceParameterSnapshotsPage,
  type DeviceConfigurationBatchLookup,
  type DeviceConfigurationHistoryQuery,
  type DeviceMeasurementConfigurationChange,
  type DeviceParameterCatalogQuery,
  type DeviceParameterSnapshotsQuery,
  type DeviceParameterWrite,
  type StartDeviceConfigurationBatch,
  type StartDeviceMeasurementConfigurationChange,
  type StartDeviceParameterChange,
  type StartDeviceParameterSnapshot,
  type StartDeviceParametersChange,
  type StopDeviceConfigurationBatch,
} from '@discocan/device-contract';
import { Injectable } from '@nestjs/common';
import {
  date,
  integer,
  integerOrNull,
  recordOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import type {
  FleetDeviceConfigurationBatch,
  FleetDeviceConfigurationChange,
  FleetDeviceParameterDefinition,
  FleetDeviceParameterSnapshot,
  FleetErmConfigurationStep,
} from '../../generated/graphql/types.js';
import { invalid } from '../../validation.js';
import type { InspectionCaller } from '../device-adapter.js';
import { ermCommand, ermCommandFields, stringList } from './erm-command-evidence.js';
import { ermEntity, ermMutate, ermOperation } from './erm-api.js';

const ermSnapshotFields = `
  id imei: unitId actorId intent status startedAt finishedAt parameterCount readCount failureReason
  values { parameter title value resultCode outcome }
  unreadParameters
  changes { parameter title previousValue value }
`;

export const ermConfigurationChangeFields = `
  id imei: unitId actorId intent operation parameter parameters batchId batchIndex status
  startedAt finishedAt failureReason baseline intended steps
  stepDetails {
    name at outcome outcomeCode commandId payload configuration
    transportCommand { ${ermCommandFields} }
  }
`;

const ermConfigurationBatchFields = `
  id actorId createdAt finishedAt stoppedAt stoppedByActorId
  changes { ${ermConfigurationChangeFields} }
`;

const ermParameterCatalogFields = `
  total offset limit features
  items { parameter code title summary defaultValue writable features options { value label } }
`;

function parameterId(parameter: number): string {
  return String(parameter).padStart(4, '0');
}

function parameterNumbers(row: Record<string, unknown>, field: string): number[] {
  const value = row[field];
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid StarLink parameter list');
  }
  return value.map((parameter: unknown) => integer({ parameter }, 'parameter'));
}

function ermParameterSnapshot(value: unknown): FleetDeviceParameterSnapshot {
  const row = recordOf(value);
  const unreadParameters = parameterNumbers(row, 'unreadParameters');
  return {
    ...parseDeviceParameterSnapshot(
      { ...row, unreadParameterIds: unreadParameters.map(parameterId) },
      (value) => {
        const entry = recordOf(value);
        const parameter = integer(entry, 'parameter');
        return {
          ...parseDeviceSnapshotValue({ ...entry, parameterId: parameterId(parameter) }),
          erm: { parameter, resultCode: textOrNull(entry, 'resultCode') },
        };
      },
      (value) => {
        const entry = recordOf(value);
        const parameter = integer(entry, 'parameter');
        return {
          ...parseDeviceParameterDifference({ ...entry, parameterId: parameterId(parameter) }),
          erm: { parameter },
        };
      },
    ),
    erm: { unreadParameters },
  };
}

function ermParameterDefinition(value: unknown): FleetDeviceParameterDefinition {
  const row = recordOf(value);
  return {
    ...parseDeviceParameterDefinition({ ...row, parameterId: row.code }),
    erm: { parameter: integer(row, 'parameter'), features: stringList(row.features) },
  };
}

function configurationStep(row: Record<string, unknown>): FleetErmConfigurationStep {
  return {
    name: text(row, 'name'),
    at: date(row, 'at'),
    outcome: text(row, 'outcome'),
    outcomeCode: text(row, 'outcomeCode'),
    commandId: textOrNull(row, 'commandId'),
    payload: textOrNull(row, 'payload'),
    configuration: row.configuration,
    transportCommand: row.transportCommand === null ? null : ermCommand(row.transportCommand),
  };
}

function measurementBaseline(
  baseline: Record<string, unknown>,
  steps: FleetErmConfigurationStep[],
) {
  const globalsHex =
    steps.find(({ name, outcome }) => name === 'globals' && outcome === 'COMPLETE')?.payload ??
    baseline.globals ??
    null;
  const profile = steps.find(
    ({ name, outcome }) => name === 'profile' && outcome === 'COMPLETE',
  )?.payload;
  if (baseline.definitions === undefined && globalsHex === null && profile == null) {
    return null;
  }
  return {
    configurationId: baseline.configurationId ?? null,
    observedAt: baseline.observedAt ?? null,
    definitions:
      baseline.definitions === undefined
        ? []
        : rowsOf(baseline.definitions, (entry) => ({
            parameterId: entry.parameter,
            intervalSeconds: entry.interval,
            definitionHex: entry.definition,
          })),
    globalsHex,
    profileId: profile == null ? null : Number.parseInt(profile.slice(2), 16),
  };
}

export function ermConfigurationChange(value: unknown): FleetDeviceConfigurationChange {
  const row = recordOf(value);
  const parameter = integerOrNull(row, 'parameter');
  const parameters = parameterNumbers(row, 'parameters');
  const stepDetails = rowsOf(row.stepDetails, configurationStep);
  const measurement = row.operation !== 'PARAMETER' && row.operation !== 'PARAMETERS';
  return {
    ...parseDeviceConfigurationChange({
      ...row,
      operation: row.operation === 'READ_EDATA' ? 'READ_MEASUREMENT_CONFIGURATION' : row.operation,
      parameterIds: parameters.map(parameterId),
      measurementParameterId: measurement ? parameter : null,
      measurementConfiguration: measurement
        ? measurementBaseline(recordOf(row.baseline), stepDetails)
        : null,
    }),
    erm: {
      parameter,
      parameters,
      baseline: row.baseline,
      intended: textOrNull(row, 'intended'),
      steps: row.steps,
      stepDetails,
    },
  };
}

function ermConfigurationBatch(value: unknown): FleetDeviceConfigurationBatch {
  return { ...parseDeviceConfigurationBatch(value, ermConfigurationChange), deviceType: 'ERM' };
}

function measurementInput(input: DeviceMeasurementConfigurationChange) {
  switch (input.operation) {
    case 'READ':
      return { read: true };
    case 'INTERVAL':
      return { parameterId: input.parameterId, intervalSeconds: input.intervalSeconds };
    case 'ADD_DEFINITION':
      return { definitionHex: input.definitionHex };
    case 'GLOBALS':
      return { globalsHex: input.globalsHex };
  }
}

function ermWrite({ parameterId, value }: DeviceParameterWrite, path: string) {
  if (!/^\d{4}$/.test(parameterId)) {
    invalid(path, 'Choose a four-digit parameter from the ERM catalog.', 'INVALID_FORMAT');
  }
  return { parameter: parameterId, value };
}

@Injectable()
export class ErmConfiguration {
  startParameterSnapshot({ device }: StartDeviceParameterSnapshot, caller: InspectionCaller) {
    return ermMutate(
      'startErmParameterSnapshot',
      'StartErmParameterSnapshotInput',
      { deviceId: device.id },
      ermSnapshotFields,
      caller,
      ermParameterSnapshot,
    );
  }

  parameterSnapshots(
    { device, pageSize, offset, cursor, direction }: DeviceParameterSnapshotsQuery,
    caller: InspectionCaller,
  ) {
    return ermEntity(
      `query FleetParameterSnapshots($devices: [_Any!]!, $input: ErmDevicePageInput!) {
        _entities(representations: $devices) {
          ... on FleetDevice {
            ermParameterSnapshots(input: $input) {
              total offset limit cursor nextCursor hasMore items { ${ermSnapshotFields} }
            }
          }
        }
      }`,
      device,
      { input: { pageSize, offset, cursor, direction } },
      'ermParameterSnapshots',
      caller,
      (value) => parseDeviceParameterSnapshotsPage(value, ermParameterSnapshot),
    );
  }

  parameterCatalog(
    {
      search,
      writableOnly,
      offset,
      limit,
      ermFeature,
    }: DeviceParameterCatalogQuery & { ermFeature?: string },
    caller: InspectionCaller,
  ) {
    return ermOperation(
      `query FleetParameterCatalog($input: ErmParameterCatalogInput!) {
        ermParameterCatalog(input: $input) { ${ermParameterCatalogFields} }
      }`,
      { input: { search, writableOnly, offset, limit, feature: ermFeature } },
      'ermParameterCatalog',
      caller,
      (value) => ({
        ...parseDeviceParameterCatalogPage(value, ermParameterDefinition),
        erm: { features: stringList(recordOf(value).features) },
      }),
    );
  }

  configurationChanges({ device }: DeviceConfigurationHistoryQuery, caller: InspectionCaller) {
    return ermEntity(
      `query FleetConfigurationChanges($devices: [_Any!]!) {
        _entities(representations: $devices) {
          ... on FleetDevice { ermConfigurationChanges { ${ermConfigurationChangeFields} } }
        }
      }`,
      device,
      {},
      'ermConfigurationChanges',
      caller,
      (value) => parseDeviceConfigurationHistory(value, ermConfigurationChange),
    );
  }

  configurationWritesEnabled(
    { device }: DeviceConfigurationHistoryQuery,
    caller: InspectionCaller,
  ) {
    return ermEntity(
      `query FleetConfigurationWritesEnabled($devices: [_Any!]!) {
        _entities(representations: $devices) {
          ... on FleetDevice { ermConfigurationWritesEnabled }
        }
      }`,
      device,
      {},
      'ermConfigurationWritesEnabled',
      caller,
      parseDeviceConfigurationWritesEnabled,
    );
  }

  startMeasurementConfigurationChange(
    request: StartDeviceMeasurementConfigurationChange,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'startErmEdataChange',
      'StartErmEdataChangeInput',
      {
        deviceId: request.device.id,
        ...measurementInput(request),
        restoreAfter: request.restoreAfter,
      },
      ermConfigurationChangeFields,
      caller,
      ermConfigurationChange,
    );
  }

  startParameterChange(
    { device, parameterId, value, restoreAfter }: StartDeviceParameterChange,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'startErmParameterChange',
      'StartErmParameterChangeInput',
      { deviceId: device.id, ...ermWrite({ parameterId, value }, 'parameterId'), restoreAfter },
      ermConfigurationChangeFields,
      caller,
      ermConfigurationChange,
    );
  }

  startParametersChange(
    { device, parameters, restoreAfter }: StartDeviceParametersChange,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'startErmParametersChange',
      'StartErmParametersChangeInput',
      {
        deviceId: device.id,
        parameters: parameters.map((parameter) => ermWrite(parameter, 'parameters')),
        restoreAfter,
      },
      ermConfigurationChangeFields,
      caller,
      ermConfigurationChange,
    );
  }

  startConfigurationBatch(
    { devices, parameters, restoreAfter }: StartDeviceConfigurationBatch,
    caller: InspectionCaller,
  ) {
    return ermMutate(
      'startErmParameterBatch',
      'StartErmParameterBatchInput',
      {
        deviceIds: devices.map(({ id }) => id),
        parameters: parameters.map((parameter) => ermWrite(parameter, 'parameters')),
        restoreAfter,
      },
      ermConfigurationBatchFields,
      caller,
      ermConfigurationBatch,
    );
  }

  getConfigurationBatch({ batchId }: DeviceConfigurationBatchLookup, caller: InspectionCaller) {
    return ermOperation(
      `query FleetConfigurationBatch($id: ID!) {
        ermConfigurationBatch(id: $id) { ${ermConfigurationBatchFields} }
      }`,
      { id: batchId },
      'ermConfigurationBatch',
      caller,
      (value) => (value === null ? null : ermConfigurationBatch(value)),
    );
  }

  stopConfigurationBatch({ batchId }: StopDeviceConfigurationBatch, caller: InspectionCaller) {
    return ermOperation(
      `mutation FleetStopConfigurationBatch($id: ID!) {
        stopErmConfigurationBatch(id: $id) { ${ermConfigurationBatchFields} }
      }`,
      { id: batchId },
      'stopErmConfigurationBatch',
      caller,
      ermConfigurationBatch,
    );
  }
}
