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
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Daily report',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
type DailyReport = WithTypename<AdminKarmaDailyReportQuery>['karmaDailyReport'];

function routed(carId = '41', fragment = ''): NonNullable<Story['render']> {
  return () => ({
    ...routeAt(
      `karma-client/cars/${carId}?day=2026-01-01&listQ=KARMA&listSize=25&listProject=12${fragment}`,
    )(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Complete: Story = { render: routed() };
export const Empty: Story = { render: routed('42') };
export const PartialRetrieval: Story = { render: routed('43') };
export const UpstreamUnavailable: Story = { render: routed('45') };
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
export const Mobile: Story = {
  render: routed('41'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const CompleteComparison: Story = {
  render: routed('41', '&compareDay=2025-12-31'),
  beforeEach: comparison,
};

function comparison() {
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
    return { karmaDailyReport: baseline() };
  });
  graphqlFixture(AdminKarmaPositionSamplesDocument, (variables) => {
    const input = variables.object('input');
    const result = fixtureKarmaPositionSamples(
      input.requiredString('carId'),
      input.requiredString('startMessageId'),
      input.requiredString('stopMessageId'),
    );
    const trip = baseline().trips.find(
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
}

function reportFor(carId: string): DailyReport {
  const report = fixtureKarmaDailyReports[carId];
  if (!report) {
    throw fixtureError('NOT_FOUND', `No daily-report snapshot for synthetic car ${carId}.`);
  }
  return report;
}

function baseline(): DailyReport {
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
  return report;
}
