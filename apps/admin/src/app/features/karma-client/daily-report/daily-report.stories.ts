import type { Meta, StoryObj } from '@storybook/angular-vite';
import {
  AdminKarmaDailyReportDocument,
  AdminKarmaPositionSamplesDocument,
  type AdminKarmaDailyReportQuery,
} from '../../../../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type WithTypename,
} from '../../../../storybook/graphql-fixtures';
import {
  fixtureKarmaDailyReports,
  fixtureKarmaPositionSamples,
} from '../../../../storybook/karma-fixtures';
import { StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Daily report',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
type DailyReport = WithTypename<AdminKarmaDailyReportQuery>['karmaDailyReport'];
type ComparisonState = 'complete' | 'zero' | 'partial' | 'missing-metric' | 'error';

function routed(carId = '41', language = 'en', fragment = ''): NonNullable<Story['render']> {
  return () => ({
    props: {
      url: `/${language}/karma-client/cars/${carId}?day=2026-01-01&listQ=KARMA&listSize=25&listProject=12${fragment}`,
    },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Complete: Story = { render: routed() };
export const Empty: Story = { render: routed('42') };
export const PartialRetrieval: Story = { render: routed('43') };
export const MissingMaximumSpeed: Story = { render: routed('44') };
export const UpstreamUnavailable: Story = { render: routed('45') };
export const SelectedTrip: Story = { render: routed('41', 'en', '#trip-9000000001') };
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaDailyReport: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const TransportError: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaDailyReport: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Bulgarian: Story = { render: routed('41', 'bg') };
export const Mobile: Story = {
  render: routed('41', 'bg'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: routed(), globals: { theme: 'dark' } };

export const CompleteComparison: Story = {
  render: routed('41', 'en', '&compareDay=2025-12-31'),
  beforeEach: comparison('complete'),
};
export const ZeroBaseline: Story = {
  ...CompleteComparison,
  beforeEach: comparison('zero'),
};
export const PartialComparison: Story = {
  ...CompleteComparison,
  beforeEach: comparison('partial'),
};
export const MissingMetricComparison: Story = {
  ...CompleteComparison,
  beforeEach: comparison('missing-metric'),
};
export const ComparisonError: Story = {
  ...CompleteComparison,
  beforeEach: comparison('error'),
};
export const BulgarianComparison: Story = {
  ...CompleteComparison,
  render: routed('41', 'bg', '&compareDay=2025-12-31'),
};
export const MobileComparison: Story = {
  ...BulgarianComparison,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const DarkComparison: Story = {
  ...CompleteComparison,
  globals: { theme: 'dark' },
};

function comparison(state: ComparisonState): NonNullable<Story['beforeEach']> {
  return () => {
    graphqlFixture(AdminKarmaDailyReportDocument, (variables) => {
      const input = variables.object('input');
      const carId = input.requiredString('carId');
      const day = input.string('day');
      if (carId !== '41' || day === null || day === '2026-01-01') {
        return { karmaDailyReport: reportFor(carId) };
      }
      if (day !== '2025-12-31') {
        throw fixtureError('NOT_FOUND', 'No connected comparison snapshot for this day.');
      }
      if (state === 'error') {
        throw fixtureError('SERVICE_UNAVAILABLE', 'The comparison snapshot is unavailable.');
      }
      return { karmaDailyReport: baseline(state) };
    });
    graphqlFixture(AdminKarmaPositionSamplesDocument, (variables) => {
      const input = variables.object('input');
      const result = fixtureKarmaPositionSamples(
        input.requiredString('carId'),
        input.requiredString('startMessageId'),
        input.requiredString('stopMessageId'),
      );
      const trip = baseline('complete').trips.find(
        (row) =>
          row.carId === result.carId &&
          row.startMessageId === result.startMessageId &&
          row.stopMessageId === result.stopMessageId,
      );
      if (!trip) {
        return { karmaPositionSamples: result };
      }
      const utc =
        trip.id === '8000000001'
          ? ['07:00:00', '07:00:00', '07:20:00', '07:30:00']
          : ['10:00:00', '10:00:00', '10:40:00', '11:00:00'];
      const local =
        trip.id === '8000000001'
          ? ['09:00:00', '09:00:00', '09:20:00', '09:30:00']
          : ['12:00:00', '12:00:00', '12:40:00', '13:00:00'];
      return {
        karmaPositionSamples: {
          ...result,
          retrievedAt: '2026-01-02T07:05:00.000Z',
          samples: result.samples.map((sample, index) => {
            const eventAt = utc[index];
            const sourceLocal = local[index];
            return {
              ...sample,
              instantUtc: eventAt ? `2025-12-31T${eventAt}Z` : null,
              event: {
                ...sample.event,
                edt: eventAt ? `2025-12-31 ${eventAt}` : null,
                edtTz: sourceLocal ? `2025-12-31 ${sourceLocal}` : null,
              },
            };
          }),
        },
      };
    });
    return () => {
      graphqlFixture(AdminKarmaDailyReportDocument, (variables) => ({
        karmaDailyReport: reportFor(variables.object('input').requiredString('carId')),
      }));
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
    };
  };
}

function reportFor(carId: string): DailyReport {
  const report = fixtureKarmaDailyReports[carId];
  if (!report) {
    throw fixtureError('NOT_FOUND', `No daily-report snapshot for synthetic car ${carId}.`);
  }
  return report;
}

function baseline(state: Exclude<ComparisonState, 'error'>): DailyReport {
  const primary = reportFor('41');
  const metric = (
    original: DailyReport['totalDistance'],
    value: number | null,
    availability: DailyReport['totalDistance']['availability'] = 'COMPLETE',
    availableInputs = 2,
    requiredInputs = 2,
  ): DailyReport['totalDistance'] => ({
    ...original,
    value,
    availability,
    availableInputs,
    requiredInputs,
  });
  const report: DailyReport = {
    ...primary,
    day: '2025-12-31',
    fromLocal: '2025-12-31T00:00:00',
    toLocalExclusive: '2026-01-01T00:00:00',
    fromUtc: '2025-12-30T22:00:00.000Z',
    toUtcExclusive: '2025-12-31T22:00:00.000Z',
    retrievedAt: '2026-01-02T07:05:00.000Z',
    trips: primary.trips.map((trip, index) => ({
      ...trip,
      id: index === 0 ? '8000000001' : '8000000002',
      startMessageId: index === 0 ? '2000000500' : '2000000700',
      stopMessageId: index === 0 ? '2000000600' : '2000000800',
      startDate: index === 0 ? '2025-12-31 09:00:00' : '2025-12-31 12:00:00',
      stopDate: index === 0 ? '2025-12-31 09:30:00' : '2025-12-31 13:00:00',
      tripDuration: index === 0 ? 30 : 60,
      startOdo: index === 0 ? 900 : 908,
      stopOdo: index === 0 ? 908 : 914,
      tripDistance: index === 0 ? 8 : 6,
      tripDistanceNight: index === 0 ? 1 : 2,
      maxSpeed: index === 0 ? 40 : 45,
    })),
    tripCount: metric(primary.tripCount, 2),
    totalDistance: metric(primary.totalDistance, 14),
    nightDistance: metric(primary.nightDistance, 3),
    dayDistance: metric(primary.dayDistance, 11),
    maxSpeed: metric(primary.maxSpeed, 45),
  };
  if (state === 'zero') {
    return {
      ...report,
      state: 'EMPTY',
      pageRequests: 1,
      loadedTrips: 0,
      trips: [],
      tripCount: metric(report.tripCount, 0, 'COMPLETE', 0, 0),
      totalDistance: metric(report.totalDistance, 0, 'COMPLETE', 0, 0),
      nightDistance: metric(report.nightDistance, 0, 'COMPLETE', 0, 0),
      dayDistance: metric(report.dayDistance, 0, 'COMPLETE', 0, 0),
      maxSpeed: metric(report.maxSpeed, null, 'UNAVAILABLE', 0, 0),
    };
  }
  if (state === 'partial') {
    return {
      ...report,
      state: 'PARTIAL',
      retrieval: 'PARTIAL',
      reason: 'PAGE_LIMIT',
      pageRequests: 4,
      loadedTrips: 1,
      trips: report.trips.slice(0, 1),
      tripCount: metric(report.tripCount, 1, 'PARTIAL', 1, 1),
      totalDistance: metric(report.totalDistance, 8, 'PARTIAL', 1, 1),
      nightDistance: metric(report.nightDistance, 1, 'PARTIAL', 1, 1),
      dayDistance: metric(report.dayDistance, 7, 'PARTIAL', 1, 1),
      maxSpeed: metric(report.maxSpeed, 40, 'PARTIAL', 1, 1),
    };
  }
  return state === 'missing-metric'
    ? {
        ...report,
        state: 'PARTIAL',
        trips: report.trips.map((trip) => ({ ...trip, maxSpeed: null })),
        maxSpeed: metric(report.maxSpeed, null, 'UNAVAILABLE', 0),
      }
    : report;
}
