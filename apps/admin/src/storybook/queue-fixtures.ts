import {
  AdminControlCenterBranchCommandRequestsDocument,
  AdminControlCenterCommandBatchDocument,
  AdminControlCenterStartCommandBatchDocument,
  AdminControlCenterStopCommandBatchDocument,
  AdminControlCenterRetryCommandDocument,
  AdminControlCenterCancelCommandDocument,
  type AdminControlCenterCommandBatchFieldsFragment,
  type AdminControlCenterCommandRequestFieldsFragment,
  type AdminControlCenterStartCommandBatchMutation,
  type AdminControlCenterStopCommandBatchMutation,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import {
  commandFixture,
  commandAcknowledgedFixture,
  commandFailedFixture,
} from './erm-command-fixtures';
import { fixtureDevice } from './devices-fixtures';

const batchId = 'd0000000-0000-4000-8000-000000000001';
const waitingRequest = commandFixture({
  batchId,
  batchIndex: 0,
  waitingReason: 'UNIT_NOT_CONNECTED',
  waitingSince: '2026-10-20T07:58:00.000Z',
});
const requests = [
  waitingRequest,
  commandAcknowledgedFixture,
  commandFailedFixture,
  commandFixture({
    id: 'a0000000-0000-4000-8000-000000000009',
    status: 'ANSWERED',
    outcomeCode: 'RESPONSE_RECEIVED',
    action: 'READ_VERSION',
    actionCode: 'READ_VERSION',
    displayParameters: { expiresInSeconds: 7200, requestedFields: ['FIRMWARE_VERSION'] },
    answeredAt: '2026-10-20T08:00:00.000Z',
    completedAt: '2026-10-20T08:00:00.000Z',
    resultCode: null,
    responseText: 'StarLink fixture firmware',
  }),
];
const batch: AdminControlCenterCommandBatchFieldsFragment = {
  id: batchId,
  actorId: 'demo:tenant',
  action: 'READ_STATUS',
  createdAt: '2026-10-20T07:58:00.000Z',
  stoppedAt: null,
  stoppedByActorId: null,
  counts: [{ status: 'QUEUED', count: 1 }],
  requests: [waitingRequest],
};

graphqlFixture(AdminControlCenterBranchCommandRequestsDocument, (variables) => {
  const filter = variables.object('filter');
  const statuses = filter.strings('statuses');
  const ids = filter.strings('deviceIds');
  const filtered = requests.filter(
    (request) =>
      (!statuses?.length || statuses.includes(request.status)) &&
      (!ids?.length || ids.includes(request.deviceId)),
  );
  const offset = variables.int('offset', 0);
  const limit = variables.int('limit', 20);
  return {
    ermCommandRequests: {
      total: filtered.length,
      offset,
      limit,
      items: filtered.slice(offset, offset + limit),
    },
  };
});
graphqlFixture(AdminControlCenterCommandBatchDocument, () => ({ ermCommandBatch: batch }));
graphqlFixture(
  AdminControlCenterStartCommandBatchDocument,
  (variables): WithTypename<AdminControlCenterStartCommandBatchMutation> => {
    const input = variables.object('input');
    const deviceIds = input.strings('deviceIds') ?? [fixtureDevice.id];
    return {
      startErmCommandBatch: {
        ...batch,
        requests: deviceIds.map((deviceId, index) =>
          commandFixture({
            id: `a0000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
            deviceId,
            batchId,
            batchIndex: index,
          }),
        ),
        counts: [{ status: 'QUEUED', count: deviceIds.length }],
      },
    };
  },
);
graphqlFixture(
  AdminControlCenterStopCommandBatchDocument,
  (): WithTypename<AdminControlCenterStopCommandBatchMutation> => ({
    stopErmCommandBatch: {
      ...batch,
      stoppedAt: '2026-10-20T08:00:05.000Z',
      stoppedByActorId: 'demo:tenant',
      counts: [{ status: 'CANCELLED', count: batch.requests.length }],
      requests: batch.requests.map((request): AdminControlCenterCommandRequestFieldsFragment => ({
        ...request,
        status: 'CANCELLED',
        cancelledAt: '2026-10-20T08:00:05.000Z',
        completedAt: '2026-10-20T08:00:05.000Z',
        outcomeCode: 'CANCELLED',
      })),
    },
  }),
);
graphqlFixture(AdminControlCenterRetryCommandDocument, (variables) => ({
  retryErmDeviceCommand: commandFixture({
    id: 'a0000000-0000-4000-8000-000000000030',
    retryOfId: variables.object('input').requiredString('requestId'),
  }),
}));
graphqlFixture(AdminControlCenterCancelCommandDocument, (variables) => ({
  cancelErmDeviceCommand: commandFixture({
    id: variables.object('input').requiredString('requestId'),
    status: 'CANCELLED',
    outcomeCode: 'CANCELLED',
    cancelledAt: '2026-10-20T08:00:05.000Z',
    completedAt: '2026-10-20T08:00:05.000Z',
  }),
}));
