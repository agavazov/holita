import {
  AdminControlCenterConfigurationBatchDocument,
  AdminControlCenterStartEdataChangeDocument,
  AdminControlCenterStartParameterBatchDocument,
  AdminControlCenterStartParameterChangeDocument,
  AdminControlCenterStartParametersChangeDocument,
  AdminControlCenterStopConfigurationBatchDocument,
  type AdminControlCenterConfigurationBatchQuery,
  type AdminControlCenterConfigurationChangeFieldsFragment,
  type AdminControlCenterStartEdataChangeMutation,
  type AdminControlCenterStartParameterBatchMutation,
  type AdminControlCenterStartParameterChangeMutation,
  type AdminControlCenterStartParametersChangeMutation,
  type AdminControlCenterStopConfigurationBatchMutation,
} from '../generated/graphql/operations';
import { fixtureDevice } from './devices-fixtures';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureAccount } from './session-fixtures';

export const settingsWritableDeviceId = '60000000-0000-4000-8000-000000000006';
export const settingsBatchDeviceId = '60000000-0000-4000-8000-000000000007';
const batchId = 'e0000000-0000-4000-8000-000000000001';
type ConfigurationChange = WithTypename<AdminControlCenterConfigurationChangeFieldsFragment>;
type ConfigurationBatch = WithTypename<
  NonNullable<AdminControlCenterConfigurationBatchQuery['ermConfigurationBatch']>
>;

const parametersChange = {
  __typename: 'ErmConfigurationChange',
  id: 'e0000000-0000-4000-8000-000000000002',
  unitId: fixtureDevice.imei,
  actorId: fixtureAccount.id,
  intent: 'Set parameters 0022, 0106',
  parameter: null,
  operation: 'PARAMETERS',
  parameters: [22, 106],
  batchId: null,
  batchIndex: null,
  status: 'VERIFIED',
  startedAt: '2026-10-20T07:58:00.000Z',
  finishedAt: '2026-10-20T07:58:20.000Z',
  failureReason: null,
  baseline: {
    parameters: [
      { parameter: '0022', value: '300' },
      { parameter: '0106', value: '60' },
    ],
  },
  intended: '0022=600, 0106=120',
  steps: [
    {
      name: 'before',
      time: '2026-10-20T07:58:05.000Z',
      outcome: 'COMPLETE',
      payload: '0022=300, 0106=60',
    },
    {
      name: 'preflight',
      time: '2026-10-20T07:58:10.000Z',
      outcome: 'COMPLETE',
      payload: '0022=300, 0106=60',
    },
    { name: 'write', time: '2026-10-20T07:58:15.000Z', outcome: 'ANSWERED 01' },
    {
      name: 'readback',
      time: '2026-10-20T07:58:20.000Z',
      outcome: 'VERIFIED',
      payload: '0022=600, 0106=120',
    },
  ],
} satisfies ConfigurationChange;

const parameterChange = {
  ...parametersChange,
  id: 'e0000000-0000-4000-8000-000000000003',
  intent: 'Set parameter 0022',
  operation: 'PARAMETER',
  parameter: 22,
  parameters: [22],
  baseline: { parameter: '0022', value: '300' },
  intended: '0022=600',
} satisfies ConfigurationChange;

const edataRead = {
  ...parametersChange,
  id: 'e0000000-0000-4000-8000-000000000004',
  intent: 'Read eData configuration',
  operation: 'READ_EDATA',
  parameters: [],
  status: 'READ',
  baseline: { profile: 'eData' },
  intended: null,
  steps: [{ name: 'profile', time: '2026-10-20T07:58:20.000Z', outcome: 'READ' }],
} satisfies ConfigurationChange;

export const settingsBatchRunFixture = {
  ...parametersChange,
  batchId,
  batchIndex: 0,
} satisfies ConfigurationChange;

const activeBatchRun = {
  ...parametersChange,
  id: 'e0000000-0000-4000-8000-000000000005',
  unitId: '001234567890124',
  batchId,
  batchIndex: 1,
  status: 'RUNNING',
  startedAt: '2026-10-20T07:58:21.000Z',
  finishedAt: null,
  steps: [{ name: 'before', time: '2026-10-20T07:58:22.000Z', outcome: 'REQUESTING' }],
} satisfies ConfigurationChange;

const waitingBatchRun = {
  ...activeBatchRun,
  id: 'e0000000-0000-4000-8000-000000000006',
  unitId: '001234567890125',
  batchIndex: 2,
  steps: [],
} satisfies ConfigurationChange;

export const settingsBatchFixture = {
  __typename: 'ErmConfigurationBatch',
  id: batchId,
  actorId: fixtureAccount.id,
  createdAt: '2026-10-20T07:58:00.000Z',
  finishedAt: null,
  stoppedAt: null,
  stoppedByActorId: null,
  changes: [settingsBatchRunFixture, activeBatchRun, waitingBatchRun],
} satisfies ConfigurationBatch;

const stoppedBatch = {
  ...settingsBatchFixture,
  stoppedAt: '2026-10-20T08:00:05.000Z',
  stoppedByActorId: fixtureAccount.id,
  finishedAt: '2026-10-20T08:00:15.000Z',
  changes: [
    settingsBatchRunFixture,
    {
      ...parametersChange,
      id: activeBatchRun.id,
      unitId: activeBatchRun.unitId,
      batchId,
      batchIndex: 1,
      finishedAt: '2026-10-20T08:00:15.000Z',
    },
    {
      ...waitingBatchRun,
      status: 'REFUSED',
      failureReason:
        'Batch stopped before this unit; a preceding result was not VERIFIED or an operator stopped it',
      finishedAt: '2026-10-20T08:00:15.000Z',
    },
  ],
} satisfies ConfigurationBatch;

graphqlFixture(
  AdminControlCenterStartParametersChangeDocument,
  () =>
    ({
      startErmParametersChange: parametersChange,
    }) satisfies WithTypename<AdminControlCenterStartParametersChangeMutation>,
);

graphqlFixture(
  AdminControlCenterStartParameterChangeDocument,
  () =>
    ({
      startErmParameterChange: parameterChange,
    }) satisfies WithTypename<AdminControlCenterStartParameterChangeMutation>,
);

graphqlFixture(
  AdminControlCenterStartEdataChangeDocument,
  () =>
    ({
      startErmEdataChange: edataRead,
    }) satisfies WithTypename<AdminControlCenterStartEdataChangeMutation>,
);

graphqlFixture(
  AdminControlCenterStartParameterBatchDocument,
  () =>
    ({
      startErmParameterBatch: settingsBatchFixture,
    }) satisfies WithTypename<AdminControlCenterStartParameterBatchMutation>,
);

graphqlFixture(
  AdminControlCenterConfigurationBatchDocument,
  () =>
    ({
      ermConfigurationBatch: settingsBatchFixture,
    }) satisfies WithTypename<AdminControlCenterConfigurationBatchQuery>,
);

graphqlFixture(
  AdminControlCenterStopConfigurationBatchDocument,
  () =>
    ({
      stopErmConfigurationBatch: stoppedBatch,
    }) satisfies WithTypename<AdminControlCenterStopConfigurationBatchMutation>,
);
