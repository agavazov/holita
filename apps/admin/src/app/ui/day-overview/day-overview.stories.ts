import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import { MapPreview } from '../map-preview/map-preview';
import type { StackedRow } from '../charts/stacked-bars';
import { DayOverview, type DayMetricView, type DayTripRow } from './day-overview';

// Isolated presentation snapshots; no account reads or runtime scenario imports.
const provenance: FleetEvidenceFragment = {
  origin: 'DERIVED',
  source: 'HOLITA_SCENARIO',
  scenarioId: 'synthetic-workday',
  sourceRecordId: 'synthetic-day-1',
  eventAt: null,
  receivedAt: null,
  retrievedAt: '2026-01-02T08:00:00.000Z',
};
const period: FleetEvidencePeriodFragment = {
  from: '2026-01-01T08:00:00.000Z',
  toExclusive: '2026-01-01T20:00:00.000Z',
  timeZone: 'Europe/Sofia',
};
const coverage: FleetScenarioCoverageFragment = {
  retrieval: 'COMPLETE',
  positionCoverage: 'COMPLETE',
  positionsLoaded: 24,
  gaps: [],
};
const distance: DayMetricView = {
  value: '240',
  unit: 'km',
  context: 'Complete example selection',
  explanation: 'Sum of distances from the twelve synthetic trips in this selection.',
};
const tripCount: DayMetricView = {
  value: '12',
  unit: 'trips',
  context: 'Loaded example trips',
  explanation: 'The same twelve synthetic records are listed below.',
};
const maximumSpeed: DayMetricView = {
  value: '86',
  unit: 'km/h',
  context: 'Synthetic trip maximum',
  explanation: 'Largest example trip maximum in the selected dataset; no speed is estimated.',
};
const composition: readonly StackedRow[] = [
  {
    key: 'selected-day',
    label: '01 Jan',
    total: 240,
    totalText: '240 km',
    segments: [
      { key: 'day', value: 180, tone: 'c1' },
      { key: 'night', value: 60, tone: 'c2' },
    ],
  },
];
const trips: readonly DayTripRow[] = Array.from({ length: 12 }, (_, index) => ({
  id: `synthetic-trip-${String(index + 1)}`,
  start: `01 Jan 2026, ${String(10 + index).padStart(2, '0')}:00`,
  stop: `01 Jan 2026, ${String(10 + index).padStart(2, '0')}:30`,
  distance: '20 km',
}));
const realSource: FleetEvidenceFragment = {
  ...provenance,
  source: 'KARMA_API',
  scenarioId: null,
  sourceRecordId: 'synthetic-karma-day-1',
};
const rawDistance: DayMetricView = {
  value: '0.25',
  unit: 'source distance units',
  context: 'Physical units unconfirmed',
  explanation: 'Sum of source trip_distance values. No physical-unit conversion is applied.',
};
const rawMaximumSpeed: DayMetricView = {
  value: '48',
  unit: 'source speed units',
  context: 'Physical units unconfirmed',
  explanation: 'Maximum source max_speed value in the retrieved selection.',
};

const meta: Meta<DayOverview> = {
  title: 'Design System/Patterns/Day overview',
  component: DayOverview,
  decorators: [
    applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }),
    moduleMetadata({ imports: [MapPreview] }),
    onFrame,
  ],
  tags: ['!autodocs'],
  args: {
    language: 'en',
    provenance,
    period,
    coverage,
    distance,
    tripCount,
    maximumSpeed,
    composition,
    compositionHint: 'Day/night values belong only to this synthetic selection.',
    trips,
    loading: false,
    error: false,
    status: 'Example day',
    hint: 'The values and trip list describe the same bounded selection.',
  },
  render: (args) => ({
    props: { ...args, chosenTrip: '' },
    template: `
      <holita-day-overview
        [language]="language"
        [provenance]="provenance"
        [period]="period"
        [coverage]="coverage"
        [distance]="distance"
        [tripCount]="tripCount"
        [maximumSpeed]="maximumSpeed"
        [composition]="composition"
        [compositionHint]="compositionHint"
        [trips]="trips"
        [loading]="loading"
        [error]="error"
        [status]="status"
        [hint]="hint"
        (viewTrip)="chosenTrip = $event"
      >
        <div overviewMap>
          @if (!loading && !error) {
            <holita-map-preview
              [language]="language"
              [origin]="{ latitude: 0.125, longitude: 0.25 }"
              identity="Synthetic source point"
              originTime="2026-01-01 19:30:00 UTC"
            />
          } @else {
            <div class="app-card"><p class="app-muted">No selected point in this story state.</p></div>
          }
        </div>
        <section overviewFacts class="app-card app-stack" aria-label="Synthetic source facts">
          <h3 class="app-card__title">Synthetic source facts</h3>
          <p>One selected source point; no live account data.</p>
          @if (chosenTrip) {
            <p>Selected trip: {{ chosenTrip }}</p>
          }
        </section>
      </holita-day-overview>
    `,
  }),
};
export default meta;
type Story = StoryObj<DayOverview>;

export const Example: Story = {};
export const Real: Story = {
  args: {
    provenance: realSource,
    coverage: { ...coverage, positionCoverage: 'NOT_ASSESSED', positionsLoaded: 0 },
    distance: rawDistance,
    tripCount: {
      ...tripCount,
      value: '1',
      context: 'Loaded source trip',
      explanation: 'One trip in the retrieved selection.',
    },
    maximumSpeed: rawMaximumSpeed,
    composition: [
      {
        key: 'selected-day',
        label: '01 Jan',
        total: 0.25,
        totalText: '0.25 source units',
        segments: [
          { key: 'day', value: 0.2, tone: 'c1' },
          { key: 'night', value: 0.05, tone: 'c2' },
        ],
      },
    ],
    compositionHint: 'Source distance and night classification remain unchanged.',
    trips: [
      {
        id: 'synthetic-karma-trip-1',
        start: '01 Jan 2026, 10:00',
        stop: '01 Jan 2026, 10:30',
        distance: '0.25 source units',
      },
    ],
    status: 'Retrieval complete',
  },
};
export const Unconfirmed: Story = {
  args: {
    ...Real.args,
    distance: {
      value: null,
      unit: null,
      context: 'Required source distance is missing',
      explanation: 'A missing input is not counted as zero.',
    },
    composition: [],
    compositionHint: 'The required source inputs are not available.',
    trips: [
      {
        id: 'synthetic-karma-trip-1',
        start: '01 Jan 2026, 10:00',
        stop: '01 Jan 2026, 10:30',
        distance: '—',
      },
    ],
    status: 'Partially available report',
  },
};
export const Empty: Story = {
  args: {
    ...Real.args,
    distance: { ...rawDistance, value: '0', context: 'Complete empty retrieval' },
    tripCount: {
      value: '0',
      unit: 'trips',
      context: 'No trips returned',
      explanation: 'The completed source query returned no records for this selection.',
    },
    maximumSpeed: {
      value: null,
      unit: null,
      context: 'No trip maximum is available',
      explanation: 'An empty trip selection has no maximum speed.',
    },
    composition: [],
    compositionHint: 'The source query returned no trips.',
    trips: [],
    status: 'No trips returned',
  },
};
export const Partial: Story = {
  args: {
    coverage: {
      ...coverage,
      retrieval: 'PARTIAL',
      positionCoverage: 'PARTIAL',
      positionsLoaded: 12,
      gaps: [{ from: '2026-01-01T10:00:00.000Z', toExclusive: '2026-01-01T10:30:00.000Z' }],
    },
    distance: {
      ...distance,
      value: '120',
      context: 'Loaded subset only',
      explanation: 'Sum of the six loaded synthetic trip distances; this is not a whole-day total.',
    },
    tripCount: {
      ...tripCount,
      value: '6',
      context: 'Loaded subset only',
      explanation: 'Only the six listed synthetic trips are counted.',
    },
    composition: [
      {
        ...composition[0],
        key: 'partial-day',
        label: '01 Jan',
        total: 120,
        totalText: '120 km',
        segments: [
          { key: 'day', value: 90, tone: 'c1' },
          { key: 'night', value: 30, tone: 'c2' },
        ],
      },
    ],
    compositionHint: 'The composition applies only to the loaded subset.',
    trips: trips.slice(0, 6),
    status: 'Loaded subset',
  },
};
export const Error: Story = {
  args: {
    provenance: { ...realSource, origin: 'UNAVAILABLE', sourceRecordId: null, eventAt: null },
    coverage: {
      ...coverage,
      retrieval: 'UNAVAILABLE',
      positionCoverage: 'NOT_ASSESSED',
      positionsLoaded: 0,
    },
    distance: null,
    tripCount: null,
    maximumSpeed: null,
    composition: [],
    compositionHint: null,
    trips: null,
    error: true,
    status: 'Unavailable',
    hint: 'The source did not complete the request.',
  },
};
export const Loading: Story = {
  args: {
    provenance: null,
    distance: null,
    tripCount: null,
    maximumSpeed: null,
    composition: [],
    trips: null,
    loading: true,
    status: null,
    hint: null,
  },
};
export const Mobile: Story = {
  args: { language: 'bg' },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
