import {
  AdminErmUnitsDocument,
  AdminErmEventsDocument,
  AdminErmFramesDocument,
  AdminErmCommandsDocument,
  type AdminErmUnitsQuery,
  type AdminErmEventFieldsFragment,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

export const fixtureErmUnitId = '001234567890123';
const fixtureEvent: WithTypename<AdminErmEventFieldsFragment> = {
  __typename: 'ErmEvent',
  id: '1',
  frameId: '10',
  unitId: fixtureErmUnitId,
  eventId: '01',
  eventTime: '2026-11-03T12:00:00.000Z',
  positionTime: '2026-11-03T11:59:59.000Z',
  latitude: 42.6977,
  longitude: 23.3219,
  speedKmh: 35,
  heading: 180,
  odometer: 12345.678,
  engineOn: true,
  mainVoltage: 24.6,
  backupVoltage: 4.1,
  fields: {
    '#EDT#': '261103120000',
    '#LAT#': '+4241.8620',
    '#LONG#': '+02319.3140',
    '#VIN#': '24.6',
    extra: [],
  },
};
export const fixtureErmUnits: WithTypename<AdminErmUnitsQuery['ermUnits']> = {
  __typename: 'ErmUnitsPage',
  cursor: null,
  nextCursor: null,
  hasMore: false,
  items: [
    {
      __typename: 'ErmUnit',
      unitId: fixtureErmUnitId,
      connected: true,
      mode: 'PRIMARY',
      peer: '192.0.2.1:12000',
      connectedSince: '2026-11-03T11:30:00.000Z',
      lastFrameAt: '2026-11-03T12:00:00.000Z',
      latestEvent: fixtureEvent,
    },
    {
      __typename: 'ErmUnit',
      unitId: '001234567890124',
      connected: false,
      mode: null,
      peer: '192.0.2.2:12001',
      connectedSince: null,
      lastFrameAt: '2026-11-02T09:00:00.000Z',
      latestEvent: null,
    },
  ],
};

graphqlFixture(AdminErmUnitsDocument, () => ({ ermUnits: fixtureErmUnits }));
graphqlFixture(AdminErmEventsDocument, () => ({
  ermEvents: {
    __typename: 'ErmEventsPage',
    cursor: null,
    nextCursor: null,
    hasMore: false,
    items: [fixtureEvent],
  },
}));
graphqlFixture(AdminErmFramesDocument, () => ({
  ermFrames: {
    __typename: 'ErmFramesPage',
    cursor: null,
    nextCursor: null,
    hasMore: false,
    items: [
      {
        __typename: 'ErmFrame',
        id: '10',
        connectionId: '10000000-0000-4000-8000-000000000001',
        unitId: fixtureErmUnitId,
        direction: 'DEVICE',
        receivedAt: '2026-11-03T12:00:00.000Z',
        command: '06',
        reference: '12',
        checksum: 'OK',
        partial: false,
        displayText: '$SLU001234567890123,06,12,261103120000,01*21',
      },
      {
        __typename: 'ErmFrame',
        id: '11',
        connectionId: '10000000-0000-4000-8000-000000000001',
        unitId: fixtureErmUnitId,
        direction: 'HOLITA',
        receivedAt: '2026-11-03T12:00:00.001Z',
        command: '02',
        reference: '900000001',
        checksum: 'OK',
        partial: false,
        displayText: '$SRV001234567890123,02,900000001,12,01*8E',
      },
      {
        __typename: 'ErmFrame',
        id: '12',
        connectionId: '10000000-0000-4000-8000-000000000001',
        unitId: fixtureErmUnitId,
        direction: 'UPSTREAM',
        receivedAt: '2026-11-03T12:00:01.000Z',
        command: null,
        reference: null,
        checksum: 'ABSENT',
        partial: true,
        displayText: '$SRV\\x00\\x10',
      },
    ],
  },
}));
graphqlFixture(AdminErmCommandsDocument, () => ({
  ermCommands: {
    __typename: 'ErmCommandsPage',
    cursor: null,
    nextCursor: null,
    hasMore: false,
    items: [
      {
        __typename: 'ErmCommand',
        id: '20000000-0000-4000-8000-000000000001',
        unitId: fixtureErmUnitId,
        connectionId: '10000000-0000-4000-8000-000000000001',
        reference: '900000002',
        command: '03',
        fields: ['0774'],
        status: 'ANSWERED',
        sentAt: '2026-11-03T11:50:00.000Z',
        answeredAt: '2026-11-03T11:50:01.000Z',
        resultCode: null,
        responseText: '$SLU001234567890123,03,13,0774,example*2C',
      },
    ],
  },
}));
