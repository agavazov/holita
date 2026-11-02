import type { Meta, StoryObj } from '@storybook/angular-vite';
import type { AdminKarmaDailyReportQuery } from '../../../../generated/graphql/operations';
import { onFrame } from '../../../../storybook/story-config';
import { fixtureKarmaTrip } from '../../../../storybook/karma-fixtures';
import { DailyReportCoverage } from './daily-report-coverage';

type DailyReport = AdminKarmaDailyReportQuery['karmaDailyReport'];
type Metric = DailyReport['tripCount'];

function metric(
  value: number | null,
  unit: Metric['unit'],
  availability: Metric['availability'] = 'COMPLETE',
  availableInputs = 3,
  requiredInputs = 3,
): Metric {
  return { value, unit, availability, availableInputs, requiredInputs };
}

const complete: DailyReport = {
  carId: '41',
  car: {
    id: '41',
    carNumber: 'KARMA TEST 41',
    deviceId: '000123456789012',
    projectId: '12',
    timeZoneId: 8,
  },
  day: '2026-10-26',
  timeZone: { id: 8, name: 'Europe/Sofia' },
  fromLocal: '2026-10-26T00:00:00',
  toLocalExclusive: '2026-10-27T00:00:00',
  fromUtc: '2026-10-25T22:00:00.000Z',
  toUtcExclusive: '2026-10-26T22:00:00.000Z',
  selection: 'STARTED_IN_DAY',
  retrieval: 'COMPLETE',
  state: 'COMPLETE',
  reason: 'NONE',
  pageRequests: 3,
  loadedTrips: 3,
  trips: Array.from({ length: 3 }, (_, index) => ({
    ...fixtureKarmaTrip,
    id: String(9000000001 + index),
    startDate: '2026-10-26 09:59:00',
    stopDate: '2026-10-26 10:29:00',
    tripDistance: index === 0 ? 100 : 11.728,
    tripDistanceNight: index === 0 ? 23.456 : 0,
    maxSpeed: index === 0 ? 88.8 : 50,
  })),
  maxPages: 4,
  maxRows: 1000,
  deadlineMs: 4000,
  positionCoverage: 'NOT_ASSESSED',
  retrievedAt: '2026-10-27T07:00:00.000Z',
  tripCount: metric(3, 'COUNT'),
  totalDistance: metric(123.456, 'SOURCE_DISTANCE_UNCONFIRMED'),
  nightDistance: metric(23.456, 'SOURCE_DISTANCE_UNCONFIRMED'),
  dayDistance: metric(100, 'SOURCE_DISTANCE_UNCONFIRMED'),
  maxSpeed: metric(88.8, 'SOURCE_SPEED_UNCONFIRMED'),
};

const empty: DailyReport = {
  ...complete,
  state: 'EMPTY',
  loadedTrips: 0,
  trips: [],
  tripCount: metric(0, 'COUNT', 'COMPLETE', 0, 0),
  totalDistance: metric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
  nightDistance: metric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
  dayDistance: metric(0, 'SOURCE_DISTANCE_UNCONFIRMED', 'COMPLETE', 0, 0),
  maxSpeed: metric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
};

const partial: DailyReport = {
  ...complete,
  retrieval: 'PARTIAL',
  state: 'PARTIAL',
  reason: 'PAGE_LIMIT',
  pageRequests: 4,
  loadedTrips: 4,
  trips: [
    ...complete.trips.map((trip, index) => ({
      ...trip,
      tripDistanceNight: index === 2 ? null : trip.tripDistanceNight,
      maxSpeed: index === 2 ? null : trip.maxSpeed,
    })),
    {
      ...fixtureKarmaTrip,
      id: '9000000004',
      startDate: '2026-10-26 12:00:00',
      stopDate: '2026-10-26 13:00:00',
      tripDistance: 0,
      tripDistanceNight: null,
      maxSpeed: null,
    },
  ],
  tripCount: metric(4, 'COUNT', 'PARTIAL', 4, 4),
  totalDistance: metric(123.456, 'SOURCE_DISTANCE_UNCONFIRMED', 'PARTIAL', 4, 4),
  nightDistance: metric(23.456, 'SOURCE_DISTANCE_UNCONFIRMED', 'PARTIAL', 2, 4),
  dayDistance: metric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 2, 4),
  maxSpeed: metric(88.8, 'SOURCE_SPEED_UNCONFIRMED', 'PARTIAL', 2, 4),
};

const unavailable: DailyReport = {
  ...complete,
  retrieval: 'UNAVAILABLE',
  state: 'UNAVAILABLE',
  reason: 'UPSTREAM_FAILURE',
  pageRequests: 1,
  loadedTrips: 0,
  trips: [],
  tripCount: metric(null, 'COUNT', 'UNAVAILABLE', 0, 0),
  totalDistance: metric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
  nightDistance: metric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
  dayDistance: metric(null, 'SOURCE_DISTANCE_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
  maxSpeed: metric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0, 0),
};

const unsupported: DailyReport = {
  ...unavailable,
  retrieval: 'NOT_STARTED',
  state: 'UNSUPPORTED_PERIOD',
  reason: 'TIME_ZONE_NOT_PROVEN',
  timeZone: null,
  fromLocal: null,
  toLocalExclusive: null,
  fromUtc: null,
  toUtcExclusive: null,
  pageRequests: 0,
};

const meta: Meta<DailyReportCoverage> = {
  title: 'Admin/Karma Client/Daily report contract',
  component: DailyReportCoverage,
  decorators: [onFrame],
  tags: ['!autodocs'],
  args: { language: 'en', report: complete },
};
export default meta;
type Story = StoryObj<DailyReportCoverage>;

export const Complete: Story = {};
export const Empty: Story = { args: { report: empty } };
export const PartialWithMissingValues: Story = { args: { report: partial } };
export const CompleteRetrievalWithMissingSpeed: Story = {
  args: {
    report: {
      ...complete,
      state: 'PARTIAL',
      trips: complete.trips.map((trip) => ({ ...trip, maxSpeed: null })),
      maxSpeed: metric(null, 'SOURCE_SPEED_UNCONFIRMED', 'UNAVAILABLE', 0),
    },
  },
};
export const Unavailable: Story = { args: { report: unavailable } };
export const UnsupportedPeriod: Story = { args: { report: unsupported } };
export const Loading: Story = { args: { loading: true } };
export const Bulgarian: Story = { args: { language: 'bg', report: partial } };
export const Mobile: Story = {
  args: { language: 'bg', report: partial },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { args: { report: partial }, globals: { theme: 'dark' } };
