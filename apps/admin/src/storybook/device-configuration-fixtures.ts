import {
  AdminDeviceConfigurationPageDocument,
  AdminDeviceConfigurationTargetsDocument,
  AdminRequestDeviceConfigurationReadDocument,
  AdminRequestDeviceParameterAdditionDocument,
  AdminRequestDeviceParameterIntervalUpdateDocument,
  type AdminDeviceConfigurationOperationFragment,
} from '../generated/graphql/operations';
import { fixtureDevice } from './devices-fixtures';
import { fixtureKarmaCars } from './karma-fixtures';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';

export const configurationStoryDevices = {
  confirmed: fixtureDevice.id,
  empty: '60000000-0000-4000-8000-00000000c101',
  waiting: '60000000-0000-4000-8000-00000000c102',
  unknown: '60000000-0000-4000-8000-00000000c103',
  timedOut: '60000000-0000-4000-8000-00000000c104',
  disabled: '60000000-0000-4000-8000-00000000c105',
  emptyConfiguration: '60000000-0000-4000-8000-00000000c106',
  writeWaiting: '60000000-0000-4000-8000-00000000c107',
  writeUncertain: '60000000-0000-4000-8000-00000000c108',
  writeFailed: '60000000-0000-4000-8000-00000000c109',
  writesDisabled: '60000000-0000-4000-8000-00000000c110',
  history: '60000000-0000-4000-8000-00000000c111',
} as const;

export const fixtureConfigurationOperation: WithTypename<AdminDeviceConfigurationOperationFragment> =
  {
    __typename: 'FleetDeviceOperation',
    id: '80000000-0000-4000-8000-00000000c101',
    deviceId: configurationStoryDevices.confirmed,
    deviceImei: fixtureDevice.imei,
    karmaCarId: '41',
    karmaDeviceId: '000123456789012',
    kind: 'READ_CONFIGURATION',
    phase: 'READ_PARAMETERS',
    baselineOperationId: null,
    parameterId: null,
    intervalSeconds: null,
    previousIntervalSeconds: null,
    catalogId: null,
    profileId: null,
    writeDispatchedAt: null,
    writeUncertain: false,
    status: 'COMPLETE',
    requestedAt: '2026-10-18T06:40:00.000Z',
    dispatchedAt: '2026-10-18T06:40:01.000Z',
    completedAt: '2026-10-18T06:43:00.000Z',
    nextCheckAt: '2026-10-18T06:43:00.000Z',
    deadlineAt: '2026-10-18T06:50:00.000Z',
    errorCode: null,
    queueIds: ['300001'],
    observationCount: 2,
    coverageComplete: true,
    configuration: {
      __typename: 'FleetDeviceConfiguration',
      configurationId: '1001',
      parameters: [
        {
          __typename: 'FleetDeviceConfigurationParameter',
          parameterId: 662,
          intervalSeconds: 30,
          definitionHex: '0296' + '00'.repeat(18) + '001E',
        },
        {
          __typename: 'FleetDeviceConfigurationParameter',
          parameterId: 65000,
          intervalSeconds: 0,
          definitionHex: 'FDE8' + '00'.repeat(20),
        },
      ],
    },
  };

export const fixtureParameterPresets = [
  {
    catalogId: '90000000-0000-4000-8000-000000000956',
    catalogLabel: 'Monitor 9.56',
    parameterId: 1001,
    name: 'Fixture preset 1001',
    profileIds: [0],
  },
];

const fixtureQueuedOperation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
  ...fixtureConfigurationOperation,
  status: 'QUEUED',
  requestedAt: '2026-10-18T07:00:00.000Z',
  dispatchedAt: null,
  completedAt: null,
  nextCheckAt: '2026-10-18T07:00:00.000Z',
  deadlineAt: '2026-10-18T07:10:00.000Z',
  configuration: null,
  queueIds: [],
  observationCount: 0,
  coverageComplete: false,
};

graphqlFixture(AdminDeviceConfigurationPageDocument, (variables) => {
  const deviceId = variables.requiredString('deviceId');
  const confirmed = { ...fixtureConfigurationOperation, deviceId };
  const empty = deviceId === configurationStoryDevices.empty;
  const disabled = deviceId === configurationStoryDevices.disabled;
  const waiting = deviceId === configurationStoryDevices.waiting;
  const unknown = deviceId === configurationStoryDevices.unknown;
  const timedOut = deviceId === configurationStoryDevices.timedOut;
  const emptyConfiguration = deviceId === configurationStoryDevices.emptyConfiguration;
  const writeWaiting = deviceId === configurationStoryDevices.writeWaiting;
  const writeUncertain = deviceId === configurationStoryDevices.writeUncertain;
  const writeFailed = deviceId === configurationStoryDevices.writeFailed;
  const history = deviceId === configurationStoryDevices.history;
  const writesDisabled = deviceId === configurationStoryDevices.writesDisabled;
  const lastSnapshot = empty
    ? null
    : emptyConfiguration
      ? {
          ...confirmed,
          configuration: {
            __typename: 'FleetDeviceConfiguration',
            configurationId: '1001',
            parameters: [],
          },
        }
      : confirmed;
  const pending: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...confirmed,
    id: '80000000-0000-4000-8000-00000000c102',
    status: unknown ? 'UNKNOWN' : timedOut ? 'TIMED_OUT' : 'WAITING',
    requestedAt: timedOut ? '2026-10-18T06:48:00.000Z' : '2026-10-18T06:58:00.000Z',
    dispatchedAt: timedOut ? '2026-10-18T06:48:01.000Z' : '2026-10-18T06:58:01.000Z',
    completedAt: timedOut ? '2026-10-18T07:00:00.000Z' : null,
    nextCheckAt: '2026-10-18T07:00:10.000Z',
    deadlineAt: timedOut ? '2026-10-18T06:58:00.000Z' : '2026-10-18T07:08:00.000Z',
    configuration: null,
    queueIds: unknown ? [] : ['300002'],
    observationCount: 1,
    coverageComplete: false,
    errorCode: timedOut ? 'READ_TIMEOUT' : null,
  };
  const write: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...pending,
    kind: 'UPDATE_INTERVAL',
    phase: writeFailed ? 'READ_PARAMETERS' : 'VERIFY_PARAMETERS',
    baselineOperationId: confirmed.id,
    parameterId: 65000,
    previousIntervalSeconds: 0,
    intervalSeconds: 60,
    writeDispatchedAt: writeFailed ? null : '2026-10-18T06:59:00.000Z',
    writeUncertain,
    status: writeUncertain ? 'UNKNOWN' : writeFailed ? 'FAILED' : 'WAITING',
    completedAt: writeFailed ? '2026-10-18T07:00:00.000Z' : null,
    observationCount: writeFailed ? 2 : 1,
    coverageComplete: writeFailed,
    errorCode: writeFailed ? 'BASELINE_CHANGED' : null,
  };
  const olderSnapshot: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...confirmed,
    id: '80000000-0000-4000-8000-00000000c100',
    requestedAt: '2026-10-18T06:20:00.000Z',
    dispatchedAt: '2026-10-18T06:20:01.000Z',
    completedAt: '2026-10-18T06:23:00.000Z',
    nextCheckAt: '2026-10-18T06:23:00.000Z',
    deadlineAt: '2026-10-18T06:30:00.000Z',
    queueIds: ['300000'],
    observationCount: 1,
    configuration: {
      __typename: 'FleetDeviceConfiguration',
      configurationId: '1000',
      parameters: [
        {
          __typename: 'FleetDeviceConfigurationParameter',
          parameterId: 65000,
          intervalSeconds: 120,
          definitionHex: 'FDE8' + '00'.repeat(18) + '0078',
        },
      ],
    },
  };
  return {
    fleetDevice: { ...fixtureDevice, id: deviceId },
    fleetDeviceOperationsEnabled: !disabled,
    fleetDeviceConfigurationWritesEnabled: !disabled && !writesDisabled,
    fleetDeviceParameterPresets: fixtureParameterPresets,
    fleetDeviceOperations: empty
      ? []
      : writeWaiting || writeUncertain || writeFailed
        ? [write]
        : waiting || unknown || timedOut
          ? [pending]
          : history
            ? [confirmed, olderSnapshot]
            : lastSnapshot
              ? [lastSnapshot]
              : [],
    fleetDeviceConfigurationSnapshot: lastSnapshot,
  };
});

graphqlFixture(AdminDeviceConfigurationTargetsDocument, () => ({ karmaCars: fixtureKarmaCars }));

graphqlFixture(AdminRequestDeviceConfigurationReadDocument, (variables) => {
  const input = variables.object('input');
  const target = fixtureKarmaCars.find((car) => car.id === input.requiredString('karmaCarId'));
  if (!target || target.deviceId !== input.requiredString('expectedKarmaDeviceId')) {
    throw fixtureError('CONFLICT', 'The selected Karma device has changed.');
  }
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureConfigurationOperation,
    id: '80000000-0000-4000-8000-00000000c103',
    deviceId: input.requiredString('deviceId'),
    karmaCarId: target.id,
    karmaDeviceId: target.deviceId,
    status: 'QUEUED',
    requestedAt: '2026-10-18T07:00:00.000Z',
    dispatchedAt: null,
    completedAt: null,
    nextCheckAt: '2026-10-18T07:00:00.000Z',
    deadlineAt: '2026-10-18T07:10:00.000Z',
    configuration: null,
    observationCount: 0,
    coverageComplete: false,
    queueIds: [],
  };
  return { requestFleetDeviceConfigurationRead: operation };
});

graphqlFixture(AdminRequestDeviceParameterAdditionDocument, (variables) => {
  const input = variables.object('input');
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureQueuedOperation,
    id: '80000000-0000-4000-8000-00000000c104',
    deviceId: input.requiredString('deviceId'),
    karmaCarId: input.requiredString('karmaCarId'),
    karmaDeviceId: input.requiredString('expectedKarmaDeviceId'),
    baselineOperationId: input.requiredString('baselineOperationId'),
    catalogId: input.requiredString('catalogId'),
    parameterId: input.integer('parameterId'),
    intervalSeconds: input.integer('intervalSeconds'),
    kind: 'ADD_PARAMETER',
    phase: 'READ_PROFILE',
  };
  return { requestFleetDeviceParameterAddition: operation };
});

graphqlFixture(AdminRequestDeviceParameterIntervalUpdateDocument, (variables) => {
  const input = variables.object('input');
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureQueuedOperation,
    id: '80000000-0000-4000-8000-00000000c105',
    deviceId: input.requiredString('deviceId'),
    karmaCarId: input.requiredString('karmaCarId'),
    karmaDeviceId: input.requiredString('expectedKarmaDeviceId'),
    baselineOperationId: input.requiredString('baselineOperationId'),
    parameterId: input.integer('parameterId'),
    intervalSeconds: input.integer('intervalSeconds'),
    previousIntervalSeconds: 0,
    kind: 'UPDATE_INTERVAL',
    phase: 'READ_PARAMETERS',
  };
  return { requestFleetDeviceParameterIntervalUpdate: operation };
});
