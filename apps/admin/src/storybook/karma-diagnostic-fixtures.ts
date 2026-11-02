import {
  AdminDiagnosticReadsDocument,
  AdminKarmaDiagnosticHistoryDocument,
  type AdminDiagnosticReadOperationFragment,
  type AdminKarmaDiagnosticHistoryQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureKarmaCar } from './karma-fixtures';
import { defaultBranchId } from './session-fixtures';

// Storybook-only synthetic identities with the verified 419/NACK wire payloads.
// These snapshots never fetch or claim a current state for a real truck.
const faultPayload = '19,0,419,0,1,1,1001,21000010F30701000004DF0B01';
const nackPayload = '19,0,154,0';

const diagnosticHistory: WithTypename<AdminKarmaDiagnosticHistoryQuery['karmaDiagnosticHistory']> =
  {
    __typename: 'KarmaDiagnosticHistory',
    carId: fixtureKarmaCar.id,
    cursor: null,
    nextCursor: null,
    hasMore: false,
    retrieval: 'COMPLETE',
    reason: 'NONE',
    historyComplete: false,
    scannedRows: 2,
    maxRows: 500,
    deadlineMs: 4000,
    retrievedAt: '2026-10-29T13:00:00.000Z',
    items: [
      {
        __typename: 'KarmaDiagnosticReport',
        instantUtc: '2026-10-29T12:00:00.000Z',
        family: 'SPECIAL_ACK',
        reportCode: '154',
        decoding: 'DECODED',
        rawPayload: nackPayload,
        payloadHex: null,
        acknowledgement: 'NACK',
        communication: null,
        faults: [],
        event: {
          __typename: 'KarmaEvent',
          id: '3000000601',
          carId: fixtureKarmaCar.id,
          deviceId: fixtureKarmaCar.deviceId,
          eventId: '33',
          edt: '2026-10-29 12:00:00',
          edtTz: null,
          pdt: null,
          extra: nackPayload,
        },
      },
      {
        __typename: 'KarmaDiagnosticReport',
        instantUtc: '2026-10-28T18:54:31.000Z',
        family: 'EDATA_419',
        reportCode: '419',
        decoding: 'DECODED',
        rawPayload: faultPayload,
        payloadHex: '21000010F30701000004DF0B01',
        acknowledgement: null,
        communication: null,
        faults: [
          {
            __typename: 'KarmaDiagnosticFault',
            code: null,
            spn: 4339,
            fmi: 7,
            statusHex: '01',
            status: 'ADDED',
            rawHex: '000010F30701',
          },
          {
            __typename: 'KarmaDiagnosticFault',
            code: null,
            spn: 1247,
            fmi: 11,
            statusHex: '01',
            status: 'ADDED',
            rawHex: '000004DF0B01',
          },
        ],
        event: {
          __typename: 'KarmaEvent',
          id: '3000000600',
          carId: fixtureKarmaCar.id,
          deviceId: fixtureKarmaCar.deviceId,
          eventId: '33',
          edt: '2026-10-28 18:54:31',
          edtTz: null,
          pdt: null,
          extra: faultPayload,
        },
      },
    ],
  };

const diagnosticRead: WithTypename<AdminDiagnosticReadOperationFragment> = {
  __typename: 'FleetDeviceOperation',
  id: '80000000-0000-4000-8000-00000000d101',
  branchId: defaultBranchId,
  karmaCarId: fixtureKarmaCar.id,
  karmaDeviceId: fixtureKarmaCar.deviceId,
  kind: 'READ_FAULT_LOGGER',
  status: 'FAILED',
  requestedAt: '2026-10-29T11:59:00.000Z',
  dispatchedAt: '2026-10-29T11:59:01.000Z',
  completedAt: '2026-10-29T12:00:05.000Z',
  nextCheckAt: '2026-10-29T12:00:05.000Z',
  deadlineAt: '2026-10-29T12:09:00.000Z',
  errorCode: 'DEVICE_NACK',
  diagnosticQueue: [{ __typename: 'FleetDeviceDiagnosticQueueEntry', id: '300001', state: 1 }],
  diagnosticObservations: [
    {
      __typename: 'FleetDeviceDiagnosticObservation',
      messageId: '3000000601',
      eventTimeUtc: '2026-10-29T12:00:00.000Z',
      rawMessage: nackPayload,
      family: 'SPECIAL_ACK',
      acknowledgement: 'NACK',
    },
  ],
};

export function registerKarmaDiagnosticStoryFixtures(): void {
  graphqlFixture(AdminKarmaDiagnosticHistoryDocument, () => ({
    karmaDiagnosticHistory: diagnosticHistory,
  }));
  graphqlFixture(AdminDiagnosticReadsDocument, () => ({
    fleetDeviceOperationsEnabled: false,
    fleetDeviceDiagnosticOperations: [diagnosticRead],
  }));
}
