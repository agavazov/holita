import {
  AdminKarmaCarDocument,
  AdminKarmaCarsDocument,
  AdminKarmaEdataDocument,
  AdminKarmaEventsDocument,
  AdminKarmaDrivingProfileDocument,
  AdminKarmaLocationDocument,
  AdminKarmaReferencesDocument,
  type AdminKarmaCarsQuery,
  type AdminKarmaEdataQuery,
  type AdminKarmaEventsQuery,
  type AdminKarmaDrivingProfileQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

/** A complete immutable account list; filtering and paging belong to the real client page. */
export const fixtureKarmaCars: WithTypename<AdminKarmaCarsQuery['karmaCars']> = Array.from(
  { length: 61 },
  (_, index) => ({
    __typename: 'KarmaCar',
    id: String(41 + index),
    deviceId: String(123456789012 + index).padStart(15, '0'),
    projectId: index % 2 === 0 ? '12' : '13',
    carNumber: `KARMA TEST ${String(41 + index)}`,
    carType: 'Truck',
    carYear: '2024',
    carColor: 'White',
    timeZoneId: 8,
  }),
);

export const fixtureKarmaCar = {
  ...fixtureKarmaCars[0],
  __typename: 'KarmaCar',
  id: '41',
  deviceId: '000123456789012',
  projectId: '12',
  carNumber: 'KARMA TEST 41',
  carType: 'Truck',
  carYear: '2024',
  carColor: 'White',
  timeZoneId: 8,
  subType: null,
  driverCount: 0,
};

export const fixtureKarmaEdataMessage: WithTypename<
  AdminKarmaEdataQuery['karmaEdata']['items'][number]
> = {
  __typename: 'KarmaEdataMessage',
  id: '3000000600',
  carId: '41',
  carNumber: 'KARMA TEST 41',
  deviceId: '000123456789012',
  eventTimeUtc: '2026-01-01 09:59:00',
  eventTimeLocal: '2026-01-01 11:59:00',
  pdt: null,
  spd: 0,
  odo: 0,
  latitude: 0,
  longitude: null,
  parameters: [
    { __typename: 'KarmaEdataParameter', id: '99999', description: null, value: 0 },
    {
      __typename: 'KarmaEdataParameter',
      id: '1',
      description: 'Original parameter description',
      value: null,
    },
  ],
};
export const fixtureKarmaEvent: WithTypename<
  AdminKarmaEventsQuery['karmaEvents']['items'][number]
> = {
  __typename: 'KarmaEvent',
  id: '3000000600',
  carId: '41',
  deviceId: '000123456789012',
  eventId: '0',
  edt: '2026-01-01 09:59:00',
  edtTz: null,
  pdt: null,
  latitude: 0,
  longitude: null,
  spd: 0,
  odo: 0,
  extra: '<b>Original source event text</b>\nSecond source line',
};
export const fixtureKarmaDrivingProfile: WithTypename<
  NonNullable<AdminKarmaDrivingProfileQuery['karmaDrivingProfile']>
> = {
  __typename: 'KarmaDrivingProfile',
  carId: '41',
  carNumber: 'KARMA TEST 41',
  deviceId: '000123456789012',
  categories: [
    'accelerations',
    'brakes',
    'speed_bumps',
    'bypassing',
    'roundabout',
    'lane_change',
    'turns',
    'off_road',
    'speed',
  ].map((name, index) => ({
    __typename: 'KarmaDrivingCategory',
    name,
    score: index % 2 === 0 ? null : 0,
    weight: 0,
  })),
};

graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: fixtureKarmaCars }));
graphqlFixture(AdminKarmaReferencesDocument, () => ({
  karmaProjects: [
    { __typename: 'KarmaProject', id: '12', name: 'International' },
    { __typename: 'KarmaProject', id: '13', name: 'Regional' },
  ],
  karmaTimeZones: [{ __typename: 'KarmaTimeZone', id: 8, name: 'Europe/Sofia' }],
}));
graphqlFixture(AdminKarmaCarDocument, (variables) => ({
  karmaCar: variables.requiredString('id') === '41' ? fixtureKarmaCar : null,
}));
graphqlFixture(AdminKarmaLocationDocument, () => ({
  karmaLocation: {
    __typename: 'KarmaLocation',
    carId: '41',
    deviceId: fixtureKarmaCar.deviceId,
    carNumber: fixtureKarmaCar.carNumber,
    messageId: '3000000600',
    eventId: '0',
    edt: '2026-01-01 09:59:00',
    edtTz: '2026-01-01 11:59:00',
    pdt: null,
    latitude: 42.6977,
    longitude: 23.3219,
    spd: 0,
    odo: 0,
    extra: null,
  },
}));
graphqlFixture(AdminKarmaEdataDocument, () => ({
  karmaEdata: {
    __typename: 'KarmaEdataPage',
    items: [fixtureKarmaEdataMessage],
    hasMore: false,
    cursor: null,
    nextCursor: null,
  },
}));
graphqlFixture(AdminKarmaEventsDocument, () => ({
  karmaEvents: {
    __typename: 'KarmaEventsPage',
    items: [fixtureKarmaEvent],
    hasMore: false,
    cursor: null,
    nextCursor: null,
  },
}));
graphqlFixture(AdminKarmaDrivingProfileDocument, () => ({
  karmaDrivingProfile: fixtureKarmaDrivingProfile,
}));
