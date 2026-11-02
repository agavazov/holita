import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import {
  PointExplorer,
  type PointExplorerEndpoints,
  type PointExplorerRow,
} from './point-explorer';

const provenance: FleetEvidenceFragment = {
  origin: 'ILLUSTRATIVE',
  source: 'HOLITA_SCENARIO',
  scenarioId: 'synthetic-point-story',
  sourceRecordId: 'synthetic-trip-1',
  eventAt: null,
  receivedAt: null,
  retrievedAt: '2026-01-01T09:00:00.000Z',
};
const period: FleetEvidencePeriodFragment = {
  from: '2026-01-01T08:00:00.000Z',
  toExclusive: '2026-01-01T09:00:00.000Z',
  timeZone: 'Europe/Sofia',
};
const endpoints: PointExplorerEndpoints = {
  origin: { latitude: 0.125, longitude: 0.25 },
  destination: { latitude: 0.25, longitude: 0.5 },
  originTime: '2026-01-01T08:00:00.000Z',
  destinationTime: '2026-01-01T08:30:00.000Z',
};
const points: readonly PointExplorerRow[] = [
  {
    key: 'HOLITA_SCENARIO:synthetic-point-1',
    source: 'HOLITA_SCENARIO',
    id: 'synthetic-point-1',
    sourceTime: '2026-01-01T08:00:00.000Z',
    instantUtc: '2026-01-01T08:00:00.000Z',
    coordinates: { latitude: 0.125, longitude: 0.25 },
    provenance: {
      ...provenance,
      sourceRecordId: 'synthetic-point-1',
      eventAt: '2026-01-01T08:00:00.000Z',
    },
    facts: [
      { label: 'Source speed', value: '0 km/h' },
      { label: 'Coolant temperature', value: '72 °C' },
      { label: 'External voltage', value: '12.6 V' },
    ],
  },
  {
    key: 'HOLITA_SCENARIO:synthetic-point-2',
    source: 'HOLITA_SCENARIO',
    id: 'synthetic-point-2',
    sourceTime: '2026-01-01T08:05:00.000Z',
    instantUtc: '2026-01-01T08:05:00.000Z',
    coordinates: { latitude: 0.125, longitude: 0.25 },
    provenance: {
      ...provenance,
      sourceRecordId: 'synthetic-point-2',
      eventAt: '2026-01-01T08:05:00.000Z',
    },
    facts: [
      { label: 'Source speed', value: '0 km/h' },
      { label: 'Coolant temperature', value: '74 °C' },
      { label: 'External voltage', value: '—' },
    ],
  },
  {
    key: 'HOLITA_SCENARIO:synthetic-point-3',
    source: 'HOLITA_SCENARIO',
    id: 'synthetic-point-3',
    sourceTime: '2026-01-01T08:25:00.000Z',
    instantUtc: '2026-01-01T08:25:00.000Z',
    coordinates: { latitude: 0.15, longitude: 0.375 },
    provenance: {
      ...provenance,
      sourceRecordId: 'synthetic-point-3',
      eventAt: '2026-01-01T08:25:00.000Z',
    },
    facts: [
      { label: 'Source speed', value: '24 km/h' },
      { label: 'Coolant temperature', value: '78 °C' },
      { label: 'External voltage', value: '13.1 V' },
    ],
  },
  {
    key: 'HOLITA_SCENARIO:synthetic-point-4',
    source: 'HOLITA_SCENARIO',
    id: 'synthetic-point-4',
    sourceTime: '2026-01-01T08:30:00.000Z',
    instantUtc: '2026-01-01T08:30:00.000Z',
    coordinates: { latitude: 0.25, longitude: 0.5 },
    provenance: {
      ...provenance,
      sourceRecordId: 'synthetic-point-4',
      eventAt: '2026-01-01T08:30:00.000Z',
    },
    facts: [],
  },
];
const coverage: FleetScenarioCoverageFragment = {
  retrieval: 'COMPLETE',
  positionCoverage: 'PARTIAL',
  positionsLoaded: points.length,
  gaps: [{ from: '2026-01-01T08:10:00.000Z', toExclusive: '2026-01-01T08:20:00.000Z' }],
};

const meta: Meta<PointExplorer> = {
  title: 'Design System/Patterns/Point explorer',
  component: PointExplorer,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: {
    identity: 'Synthetic trip · synthetic-trip-1',
    endpoints,
    points,
    selectedKey: null,
    provenance,
    period,
    coverage,
    gapThresholdMinutes: 15,
    loading: false,
    error: null,
    showMap: true,
  },
  render: (args) => ({
    props: { ...args, chosenKey: args.selectedKey ?? null },
    template: `
      <holita-point-explorer
        [language]="language"
        [identity]="identity"
        [endpoints]="endpoints"
        [points]="points"
        [selectedKey]="chosenKey"
        [provenance]="provenance"
        [period]="period"
        [coverage]="coverage"
        [gapThresholdMinutes]="gapThresholdMinutes"
        [loading]="loading"
        [error]="error"
        [showMap]="showMap"
        (selectedKeyChange)="chosenKey = $event"
      />
    `,
  }),
};
export default meta;
type Story = StoryObj<PointExplorer>;

export const Loaded: Story = {};
export const SelectedPoint: Story = {
  args: { selectedKey: 'HOLITA_SCENARIO:synthetic-point-2' },
};
export const LongIntervalAndDeclaredGap: Story = {
  args: {
    selectedKey: 'HOLITA_SCENARIO:synthetic-point-3',
    coverage: { ...coverage, retrieval: 'PARTIAL' },
  },
};
export const MissingCoordinates: Story = {
  args: {
    points: points.map((point) =>
      point.id === 'synthetic-point-2' ? { ...point, coordinates: null } : point,
    ),
    selectedKey: 'HOLITA_SCENARIO:synthetic-point-2',
  },
};
export const Empty: Story = {
  args: {
    points: [],
    coverage: { ...coverage, positionsLoaded: 0, positionCoverage: 'NOT_ASSESSED', gaps: [] },
  },
};
export const Error: Story = {
  args: {
    points: null,
    provenance: { ...provenance, origin: 'UNAVAILABLE' },
    coverage: {
      retrieval: 'UNAVAILABLE',
      positionCoverage: 'NOT_ASSESSED',
      positionsLoaded: 0,
      gaps: [],
    },
    error: 'The source request did not complete. Recorded endpoints remain available.',
  },
};
export const Loading: Story = {
  args: {
    points: null,
    provenance: null,
    coverage: {
      retrieval: 'NOT_STARTED',
      positionCoverage: 'NOT_ASSESSED',
      positionsLoaded: 0,
      gaps: [],
    },
    loading: true,
  },
};
export const Mobile: Story = {
  args: { selectedKey: 'HOLITA_SCENARIO:synthetic-point-2' },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
