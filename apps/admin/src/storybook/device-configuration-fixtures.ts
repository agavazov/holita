import { encodeRuleData, encodeRuleRecord, parseRuleExpression } from '@holita/edata-rules';
import {
  AdminDeviceConfigurationPageDocument,
  AdminRequestDeviceConfigurationReadDocument,
  AdminRequestDeviceParameterAdditionDocument,
  AdminRequestDeviceParameterIntervalUpdateDocument,
  AdminRequestDeviceRuleChangeDocument,
  AdminRequestDeviceRulesReadDocument,
  type AdminDeviceConfigurationOperationFragment,
  type AdminDeviceConfigurationPageQuery,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureKarmaCars } from './karma-fixtures';
import { defaultBranchId } from './session-fixtures';

export const configurationStoryStates = {
  confirmed: 'confirmed',
  empty: 'empty',
  waiting: 'waiting',
  emptyConfiguration: 'empty-configuration',
  writeUncertain: 'write-uncertain',
  reading: 'reading',
  dispatchOff: 'dispatch-off',
  failed: 'failed',
} as const;

export const fixtureConfigurationOperation: WithTypename<AdminDeviceConfigurationOperationFragment> =
  {
    __typename: 'FleetDeviceOperation',
    id: '80000000-0000-4000-8000-00000000c101',
    branchId: defaultBranchId,
    karmaCarId: '41',
    karmaDeviceId: '000123456789012',
    kind: 'READ_CONFIGURATION',
    phase: 'READ_PARAMETERS',
    baselineOperationId: null,
    parameterBaselineOperationId: null,
    ruleId: null,
    ruleExpression: null,
    ruleTrueEventId: null,
    ruleFalseEventId: null,
    ruleDebounceMilliseconds: null,
    rulesConfiguration: null,
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
          parameterId: 718,
          intervalSeconds: 30,
          definitionHex: '02CE' + '00'.repeat(18) + '001E',
        },
        {
          __typename: 'FleetDeviceConfigurationParameter',
          parameterId: 748,
          intervalSeconds: 60,
          definitionHex: '02EC' + '00'.repeat(18) + '003C',
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
    parameterId: 718,
    name: 'ABS/EBS Amber Warning Signal',
    profileIds: [0],
  },
  {
    catalogId: '90000000-0000-4000-8000-000000000956',
    catalogLabel: 'Monitor 9.56',
    parameterId: 748,
    name: 'AC output 1 Amper',
    profileIds: [0],
  },
  {
    catalogId: '90000000-0000-4000-8000-000000000956',
    catalogLabel: 'Monitor 9.56',
    parameterId: 1001,
    name: 'Additional catalog parameter',
    profileIds: [0],
  },
];

const fixtureRule = {
  ruleId: 1,
  trueEventId: 1001,
  falseEventId: 1002,
  debounceMilliseconds: 1000,
  activateDashboard: false,
  expression: '[718] > 10',
  parameterIds: [718],
};

const fixtureRulesOperation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
  ...fixtureConfigurationOperation,
  id: '80000000-0000-4000-8000-00000000c106',
  kind: 'READ_RULES',
  phase: 'READ_RULES',
  configuration: null,
  requestedAt: '2026-10-18T06:44:00.000Z',
  dispatchedAt: '2026-10-18T06:44:01.000Z',
  completedAt: '2026-10-18T06:45:00.000Z',
  nextCheckAt: '2026-10-18T06:45:00.000Z',
  deadlineAt: '2026-10-18T06:54:00.000Z',
  rulesConfiguration: {
    __typename: 'FleetDeviceRulesConfiguration',
    configurationId: '1002',
    rules: [
      {
        __typename: 'FleetDeviceRule',
        ...fixtureRule,
        definitionHex: encodeRuleRecord({
          ...fixtureRule,
          ruleDataHex: encodeRuleData(parseRuleExpression(fixtureRule.expression)),
        }),
      },
    ],
  },
};

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

export function configurationPageFixture(
  state: string,
): WithTypename<AdminDeviceConfigurationPageQuery> {
  const confirmed = fixtureConfigurationOperation;
  const empty = state === configurationStoryStates.empty;
  const emptyConfiguration = state === configurationStoryStates.emptyConfiguration;
  const writeUncertain = state === configurationStoryStates.writeUncertain;
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
  const rulesSnapshot = empty
    ? null
    : {
        ...fixtureRulesOperation,
        ...(emptyConfiguration
          ? {
              rulesConfiguration: {
                __typename: 'FleetDeviceRulesConfiguration',
                configurationId: '1002',
                rules: [],
              },
            }
          : {}),
      };
  const pending: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...confirmed,
    id: '80000000-0000-4000-8000-00000000c102',
    status: 'WAITING',
    requestedAt: '2026-10-18T06:58:00.000Z',
    dispatchedAt: '2026-10-18T06:58:01.000Z',
    completedAt: null,
    nextCheckAt: '2026-10-18T07:00:10.000Z',
    deadlineAt: '2026-10-18T07:08:00.000Z',
    configuration: null,
    queueIds: ['300002'],
    observationCount: 1,
    coverageComplete: false,
  };
  const write: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...pending,
    kind: 'UPDATE_INTERVAL',
    phase: 'VERIFY_PARAMETERS',
    baselineOperationId: confirmed.id,
    parameterId: 65000,
    previousIntervalSeconds: 0,
    intervalSeconds: 60,
    writeDispatchedAt: '2026-10-18T06:59:00.000Z',
    writeUncertain: true,
    status: 'UNKNOWN',
  };
  const waitingWrite: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...write,
    parameterId: 718,
    previousIntervalSeconds: 30,
    writeUncertain: false,
    status: 'WAITING',
  };
  const failed: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...waitingWrite,
    status: 'FAILED',
    completedAt: '2026-10-18T07:02:00.000Z',
    errorCode: 'WRITE_READBACK_MISMATCH',
  };
  return {
    fleetDeviceOperationsEnabled: state !== configurationStoryStates.dispatchOff,
    fleetDeviceConfigurationWritesEnabled: state !== configurationStoryStates.dispatchOff,
    fleetDeviceParameterPresets: fixtureParameterPresets,
    fleetDeviceOperations: empty
      ? []
      : writeUncertain
        ? [write, ...(rulesSnapshot ? [rulesSnapshot] : []), confirmed]
        : state === configurationStoryStates.reading
          ? [pending]
          : state === configurationStoryStates.failed
            ? [failed, ...(rulesSnapshot ? [rulesSnapshot] : []), confirmed]
            : state === configurationStoryStates.waiting
              ? [waitingWrite, ...(rulesSnapshot ? [rulesSnapshot] : []), confirmed]
              : lastSnapshot
                ? [...(rulesSnapshot ? [rulesSnapshot] : []), lastSnapshot]
                : [],
    fleetDeviceConfigurationSnapshot: lastSnapshot,
    fleetDeviceRulesSnapshot: rulesSnapshot,
  };
}

graphqlFixture(AdminDeviceConfigurationPageDocument, (variables) => {
  const carId = variables.requiredString('karmaCarId');
  const target = fixtureKarmaCars.find((car) => car.id === carId);
  if (!target || target.deviceId !== variables.requiredString('expectedKarmaDeviceId')) {
    throw fixtureError('CONFLICT', 'The selected Karma device has changed.');
  }
  return configurationPageFixture(
    carId === '41' ? configurationStoryStates.confirmed : configurationStoryStates.empty,
  );
});

graphqlFixture(AdminRequestDeviceConfigurationReadDocument, (variables) => {
  const input = variables.object('input');
  const target = fixtureKarmaCars.find((car) => car.id === input.requiredString('karmaCarId'));
  if (!target || target.deviceId !== input.requiredString('expectedKarmaDeviceId')) {
    throw fixtureError('CONFLICT', 'The selected Karma device has changed.');
  }
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureConfigurationOperation,
    id: '80000000-0000-4000-8000-00000000c103',
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

graphqlFixture(AdminRequestDeviceRulesReadDocument, (variables) => {
  const input = variables.object('input');
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureQueuedOperation,
    id: '80000000-0000-4000-8000-00000000c107',
    karmaCarId: input.requiredString('karmaCarId'),
    karmaDeviceId: input.requiredString('expectedKarmaDeviceId'),
    kind: 'READ_RULES',
    phase: 'READ_RULES',
  };
  return { requestFleetDeviceRulesRead: operation };
});

graphqlFixture(AdminRequestDeviceRuleChangeDocument, (variables) => {
  const input = variables.object('input');
  const operation: WithTypename<AdminDeviceConfigurationOperationFragment> = {
    ...fixtureQueuedOperation,
    id: '80000000-0000-4000-8000-00000000c108',
    karmaCarId: input.requiredString('karmaCarId'),
    karmaDeviceId: input.requiredString('expectedKarmaDeviceId'),
    baselineOperationId: input.requiredString('baselineOperationId'),
    parameterBaselineOperationId: input.requiredString('parameterBaselineOperationId'),
    ruleId: input.integer('ruleId'),
    ruleExpression: input.requiredString('expression'),
    ruleTrueEventId: input.integer('trueEventId'),
    ruleFalseEventId: input.integer('falseEventId'),
    ruleDebounceMilliseconds: input.integer('debounceMilliseconds'),
    kind: 'UPSERT_RULE',
    phase: 'READ_PARAMETERS',
  };
  return { requestFleetDeviceRuleChange: operation };
});
