import {
  AdminKarmaCarDocument,
  AdminKarmaCarsDocument,
  AdminKarmaEdataDocument,
  AdminKarmaEventsDocument,
  AdminKarmaTripsDocument,
  AdminKarmaDailyReportDocument,
  AdminKarmaPositionSamplesDocument,
  AdminKarmaDrivingProfileDocument,
  AdminKarmaLocationDocument,
  AdminKarmaReferencesDocument,
  AdminKarmaUsersDocument,
  AdminKarmaRolesDocument,
  AdminKarmaProjectsDocument,
  AdminKarmaTimeZonesDocument,
  AdminKarmaVersionDocument,
  type AdminKarmaCarsQuery,
  type AdminKarmaEdataQuery,
  type AdminKarmaEventsQuery,
  type AdminKarmaDailyReportQuery,
  type AdminKarmaPositionSamplesQuery,
  type AdminKarmaLocationQuery,
  type KarmaTripFieldsFragment,
  type AdminKarmaDrivingProfileQuery,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';

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
export const fixtureKarmaEventWithCoordinates: typeof fixtureKarmaEvent = {
  ...fixtureKarmaEvent,
  latitude: 0,
  longitude: 0.25,
};
export const fixtureKarmaEdataMessageWithCoordinates: typeof fixtureKarmaEdataMessage = {
  ...fixtureKarmaEdataMessage,
  latitude: 0,
  longitude: 0.25,
};

function measurementParameter(
  id: string,
  description: string,
  value: number | null,
): (typeof fixtureKarmaEdataMessage)['parameters'][number] {
  return { __typename: 'KarmaEdataParameter', id, description, value };
}

/** Synthetic source-shaped messages for the connected measurement stories only. */
export const fixtureKarmaMeasurementMessages: readonly (typeof fixtureKarmaEdataMessage)[] = [
  '09:00:00',
  '09:05:00',
  '09:10:00',
  '09:35:00',
  '09:40:00',
  '09:45:00',
  '09:50:00',
  '10:00:00',
]
  .map((time, index) => ({
    ...fixtureKarmaEdataMessageWithCoordinates,
    id: String(3000000600 + index),
    eventTimeUtc: `2026-01-01 ${time}`,
    eventTimeLocal: null,
    longitude: index === 3 ? null : 0.25,
    parameters: [
      measurementParameter('1', 'Engine Speed (RPM)', index === 0 ? 0 : 1250),
      measurementParameter(
        '2',
        'Wheel Based Vehicle Speed (kph)',
        index === 0 || index === 7 ? 0 : 60,
      ),
      ...(index === 3
        ? []
        : [
            measurementParameter(
              '539',
              'Engine Coolant Temperature (c)',
              index === 2 ? null : 82 + index,
            ),
          ]),
      measurementParameter('781', 'Battery Voltage (Starlink)', index === 4 ? null : 27.6),
      measurementParameter(
        '687',
        'Engine Total Fuel Used - J1939 (L)',
        index < 4 ? 4200 + index : 2 + index,
      ),
      measurementParameter(
        '152',
        'High Resolution Total Vehicle Distance (meters)',
        125000000 + index * 1000,
      ),
      measurementParameter('64', 'Engine Total Hours Of Operation', 6200 + index / 12),
    ],
  }))
  .toReversed();
export const fixtureKarmaLocation: WithTypename<
  NonNullable<AdminKarmaLocationQuery['karmaLocation']>
> = {
  __typename: 'KarmaLocation',
  carId: '41',
  deviceId: '000123456789012',
  carNumber: 'KARMA TEST 41',
  messageId: '3000000600',
  eventId: '0',
  edt: '2026-01-01 09:59:00',
  edtTz: '2026-01-01 11:59:00',
  pdt: null,
  latitude: 0.125,
  longitude: 0.25,
  spd: 0,
  odo: 0,
  extra: null,
};
export const fixtureKarmaMissingLocationCoordinates: typeof fixtureKarmaLocation = {
  ...fixtureKarmaLocation,
  latitude: 0,
  longitude: null,
};
export function fixtureKarmaLocationResponse(carId: string): WithTypename<AdminKarmaLocationQuery> {
  const car = fixtureKarmaCars.find((row) => row.id === carId);
  return {
    karmaLocation: car
      ? {
          ...fixtureKarmaLocation,
          carId: car.id,
          deviceId: car.deviceId,
          carNumber: car.carNumber,
        }
      : null,
  };
}
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

/** Synthetic source values and offshore endpoints for the actual trip drawer. */
export const fixtureKarmaTrip: WithTypename<KarmaTripFieldsFragment> = {
  __typename: 'KarmaTrip',
  id: '9000000001',
  carId: '41',
  carNumber: 'KARMA TEST 41',
  deviceId: '000123456789012',
  driverId: null,
  tripActive: 0,
  startMessageId: '3000000500',
  startDate: '2026-01-01 09:59:00',
  startLatitude: 0.125,
  startLongitude: 0.25,
  startOdo: 1000,
  stopMessageId: '3000000600',
  stopDate: '2026-01-01 10:29:00',
  stopLatitude: 0.25,
  stopLongitude: 0.5,
  stopOdo: 1000.25,
  tripDuration: 30,
  tripDistance: 0.25,
  tripDurationNight: 0,
  tripDistanceNight: 0,
  maxSpeed: 48,
  drivingScore: null,
  ecoScore: null,
};

export function fixtureKarmaPositionSamples(
  carId = '41',
  startMessageId = '3000000500',
  stopMessageId = '3000000600',
): WithTypename<AdminKarmaPositionSamplesQuery['karmaPositionSamples']> {
  const ids = [
    startMessageId,
    String(Number(startMessageId) + 1),
    String(Number(startMessageId) + 2),
    stopMessageId,
  ];
  const times = [
    '2026-01-01 07:59:00',
    '2026-01-01 07:59:00',
    '2026-01-01 08:20:00',
    '2026-01-01 08:29:00',
  ];
  return {
    __typename: 'KarmaPositionSamples',
    carId,
    startMessageId,
    stopMessageId,
    retrieval: 'COMPLETE',
    reason: 'NONE',
    sourceClock: 'EDT_UTC',
    ordering: 'UTC_THEN_MESSAGE_ID',
    positionCoverage: 'NOT_ASSESSED',
    startMessagePresent: true,
    stopMessagePresent: true,
    loadedRows: 4,
    maxRows: 500,
    deadlineMs: 4000,
    duplicateIdsRemoved: 0,
    retrievedAt: '2026-01-02T07:00:00.000Z',
    samples: ids.map((id, index) => {
      const time = times[index] ?? null;
      return {
        __typename: 'KarmaPositionSample',
        instantUtc: time === null ? null : time.replace(' ', 'T') + 'Z',
        event: {
          ...fixtureKarmaEvent,
          carId,
          id,
          edt: time,
          edtTz:
            index === 3
              ? '2026-01-01 10:29:00'
              : index === 2
                ? '2026-01-01 10:20:00'
                : '2026-01-01 09:59:00',
          latitude: index === 3 ? 0.25 : 0.125,
          longitude: index === 2 ? null : index === 3 ? 0.5 : 0.25,
          spd: index === 0 ? 0 : 24,
        },
      };
    }),
  };
}

type DailyReport = WithTypename<AdminKarmaDailyReportQuery['karmaDailyReport']>;
type DailyMetric = DailyReport['tripCount'];

function dailyMetric(
  value: number | null,
  unit: DailyMetric['unit'],
  availability: DailyMetric['availability'] = 'COMPLETE',
  availableInputs = 2,
  requiredInputs = 2,
): DailyMetric {
  return {
    __typename: 'KarmaDailyReportMetric',
    value,
    unit,
    availability,
    availableInputs,
    requiredInputs,
  };
}

/** Fixed connected-report snapshots; these do not depend on the browser's current date. */
function dailyReportFixture(carId: string): DailyReport {
  const carNumber = `KARMA TEST ${carId}`;
  const car = {
    ...fixtureKarmaCar,
    ...fixtureKarmaCars.find((row) => row.id === carId),
    id: carId,
    carNumber,
  };
  return {
    __typename: 'KarmaDailyReport',
    carId,
    car,
    day: '2026-01-01',
    timeZone: { __typename: 'KarmaTimeZone', id: 8, name: 'Europe/Sofia' },
    fromLocal: '2026-01-01T00:00:00',
    toLocalExclusive: '2026-01-02T00:00:00',
    fromUtc: '2025-12-31T22:00:00.000Z',
    toUtcExclusive: '2026-01-01T22:00:00.000Z',
    selection: 'STARTED_IN_DAY',
    retrieval: 'COMPLETE',
    state: 'COMPLETE',
    reason: 'NONE',
    pageRequests: 3,
    loadedTrips: 2,
    trips: [
      {
        ...fixtureKarmaTrip,
        carId,
        carNumber,
        deviceId: car.deviceId,
        tripDistance: 10,
        tripDistanceNight: 2,
        maxSpeed: 50,
      },
      {
        ...fixtureKarmaTrip,
        id: '9000000002',
        carId,
        carNumber,
        deviceId: car.deviceId,
        startDate: '2026-01-01 12:00:00',
        stopDate: '2026-01-01 13:00:00',
        tripDistance: 11,
        tripDistanceNight: 2,
        maxSpeed: 51,
      },
    ],
    maxPages: 4,
    maxRows: 1000,
    deadlineMs: 4000,
    positionCoverage: 'NOT_ASSESSED',
    retrievedAt: '2026-01-02T07:00:00.000Z',
    tripCount: dailyMetric(2, 'COUNT'),
    totalDistance: dailyMetric(21, 'SOURCE_DISTANCE_UNCONFIRMED'),
    nightDistance: dailyMetric(4, 'SOURCE_DISTANCE_UNCONFIRMED'),
    dayDistance: dailyMetric(17, 'SOURCE_DISTANCE_UNCONFIRMED'),
    maxSpeed: dailyMetric(51, 'SOURCE_SPEED_UNCONFIRMED'),
  };
}

const partialDailyReport = dailyReportFixture('43');
const missingSpeedDailyReport = dailyReportFixture('44');
export const fixtureKarmaDailyReports: Readonly<Record<string, DailyReport>> = {
  '41': dailyReportFixture('41'),
  '42': {
    ...dailyReportFixture('42'),
    state: 'EMPTY',
    pageRequests: 1,
    loadedTrips: 0,
    trips: [],
    tripCount: dailyMetric(0, 'COUNT', 'COMPLETE', 0, 0),
    totalDistance: dailyMetric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
    nightDistance: dailyMetric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
    dayDistance: dailyMetric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
    maxSpeed: dailyMetric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
  },
  '43': {
    ...partialDailyReport,
    state: 'PARTIAL',
    retrieval: 'PARTIAL',
    reason: 'PAGE_LIMIT',
    pageRequests: 4,
    loadedTrips: 1,
    trips: partialDailyReport.trips.slice(0, 1),
    tripCount: dailyMetric(1, 'COUNT', 'PARTIAL', 1, 1),
    totalDistance: dailyMetric(10, 'SOURCE_DISTANCE_UNCONFIRMED', 'PARTIAL', 1, 1),
    nightDistance: dailyMetric(2, 'SOURCE_DISTANCE_UNCONFIRMED', 'PARTIAL', 1, 1),
    dayDistance: dailyMetric(8, 'SOURCE_DISTANCE_UNCONFIRMED', 'PARTIAL', 1, 1),
    maxSpeed: dailyMetric(50, 'SOURCE_SPEED_UNCONFIRMED', 'PARTIAL', 1, 1),
  },
  '44': {
    ...missingSpeedDailyReport,
    state: 'PARTIAL',
    trips: missingSpeedDailyReport.trips.map((trip) => ({ ...trip, maxSpeed: null })),
    maxSpeed: dailyMetric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0),
  },
  '45': {
    ...dailyReportFixture('45'),
    state: 'UNAVAILABLE',
    retrieval: 'UNAVAILABLE',
    reason: 'UPSTREAM_FAILURE',
    pageRequests: 0,
    loadedTrips: 0,
    trips: [],
    tripCount: dailyMetric(null, 'COUNT', 'UNAVAILABLE', 0, 0),
    totalDistance: dailyMetric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
    nightDistance: dailyMetric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
    dayDistance: dailyMetric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
    maxSpeed: dailyMetric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
  },
};

graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: fixtureKarmaCars }));
graphqlFixture(AdminKarmaPositionSamplesDocument, (variables) => {
  const input = variables.object('input');
  return {
    karmaPositionSamples: fixtureKarmaPositionSamples(
      input.requiredString('carId'),
      input.requiredString('startMessageId'),
      input.requiredString('stopMessageId'),
    ),
  };
});
graphqlFixture(AdminKarmaReferencesDocument, () => ({
  karmaProjects: [
    { __typename: 'KarmaProject', id: '12', name: 'International' },
    { __typename: 'KarmaProject', id: '13', name: 'Regional' },
  ],
  karmaTimeZones: [{ __typename: 'KarmaTimeZone', id: 8, name: 'Europe/Sofia' }],
}));
graphqlFixture(AdminKarmaCarDocument, (variables) => {
  const car = fixtureKarmaCars.find((row) => row.id === variables.requiredString('id'));
  return { karmaCar: car ? { ...fixtureKarmaCar, ...car } : null };
});
graphqlFixture(AdminKarmaLocationDocument, (variables) =>
  fixtureKarmaLocationResponse(variables.requiredString('carId')),
);
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
graphqlFixture(AdminKarmaTripsDocument, () => ({
  karmaTrips: {
    __typename: 'KarmaTripsPage',
    items: [fixtureKarmaTrip],
    hasMore: false,
    cursor: null,
    nextCursor: null,
  },
}));
graphqlFixture(AdminKarmaDailyReportDocument, (variables) => {
  const carId = variables.object('input').requiredString('carId');
  const report = fixtureKarmaDailyReports[carId];
  if (!report) {
    throw fixtureError('NOT_FOUND', `No daily-report snapshot for synthetic car ${carId}.`);
  }
  return { karmaDailyReport: report };
});
graphqlFixture(AdminKarmaDrivingProfileDocument, () => ({
  karmaDrivingProfile: fixtureKarmaDrivingProfile,
}));

graphqlFixture(AdminKarmaUsersDocument, () => ({
  karmaUsers: [
    {
      __typename: 'KarmaUser',
      id: 'fixture-001',
      userName: 'demo.dispatcher',
      active: 1,
      expireDate: null,
      roleId: 'dispatcher',
      firstName: 'Demo',
      lastName: 'Dispatcher',
      timeZoneId: 8,
      email: 'dispatcher@example.invalid',
      projectId: '12',
      projectIds: ['12', '13'],
    },
    {
      __typename: 'KarmaUser',
      id: 'fixture-002',
      userName: 'demo.viewer',
      active: 0,
      expireDate: '2026-12-31',
      roleId: 'viewer',
      firstName: 'Demo',
      lastName: 'Viewer',
      timeZoneId: 8,
      email: 'viewer@example.invalid',
      projectId: '13',
      projectIds: ['13'],
    },
  ],
}));
graphqlFixture(AdminKarmaRolesDocument, () => ({
  karmaRoles: [
    { __typename: 'KarmaRole', id: 'dispatcher', description: 'Dispatch team' },
    { __typename: 'KarmaRole', id: 'viewer', description: 'Read-only account access' },
  ],
}));
graphqlFixture(AdminKarmaProjectsDocument, () => ({
  karmaProjects: [
    { __typename: 'KarmaProject', id: '12', name: 'International' },
    { __typename: 'KarmaProject', id: '13', name: 'Regional' },
  ],
}));
graphqlFixture(AdminKarmaTimeZonesDocument, () => ({
  karmaTimeZones: [{ __typename: 'KarmaTimeZone', id: 8, name: 'Europe/Sofia' }],
}));
graphqlFixture(AdminKarmaVersionDocument, () => ({
  karmaVersion: { __typename: 'KarmaVersion', version: '2.0 (synthetic)' },
}));
