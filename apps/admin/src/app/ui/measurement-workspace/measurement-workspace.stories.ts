import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import {
  MeasurementWorkspace,
  type MeasurementChannel,
  type MeasurementReading,
  type MeasurementRecord,
} from './measurement-workspace';

const provenance: FleetEvidenceFragment = {
  origin: 'ILLUSTRATIVE',
  source: 'HOLITA_SCENARIO',
  scenarioId: 'synthetic-measurement-story',
  sourceRecordId: 'synthetic-selection',
  eventAt: null,
  receivedAt: null,
  retrievedAt: '2026-01-01T09:00:00.000Z',
};
const period: FleetEvidencePeriodFragment = {
  from: '2026-01-01T08:00:00.000Z',
  toExclusive: '2026-01-01T09:00:00.000Z',
  timeZone: 'Europe/Sofia',
};
const coverage: FleetScenarioCoverageFragment = {
  retrieval: 'COMPLETE',
  positionCoverage: 'PARTIAL',
  positionsLoaded: 4,
  gaps: [{ from: '2026-01-01T08:12:00.000Z', toExclusive: '2026-01-01T08:18:00.000Z' }],
};
const channels: readonly MeasurementChannel[] = [
  {
    key: 'speed',
    id: 'SPEED',
    label: 'Speed',
    unit: 'km/h',
    unitConfirmed: true,
    limitation: null,
  },
  {
    key: 'coolant',
    id: 'COOLANT_TEMPERATURE',
    label: 'Coolant temperature',
    unit: '°C',
    unitConfirmed: true,
    limitation: null,
  },
  {
    key: 'voltage',
    id: 'EXTERNAL_VOLTAGE',
    label: 'External voltage',
    unit: 'V',
    unitConfirmed: true,
    limitation: null,
  },
  {
    key: 'counter',
    id: 'synthetic-counter',
    label: 'Counter',
    unit: null,
    unitConfirmed: false,
    limitation: 'No counter readings were supplied in this bounded selection.',
  },
];

function reading(
  channelKey: string,
  index: number,
  value: number | null,
  at: string,
): MeasurementReading {
  const id = `synthetic-${channelKey}-reading-${String(index)}`;
  return {
    channelKey,
    id,
    value,
    description: null,
    provenance: { ...provenance, sourceRecordId: id, eventAt: at },
  };
}

const records: readonly MeasurementRecord[] = [
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
    readings: [
      reading('speed', 1, 0, '2026-01-01T08:00:00.000Z'),
      reading('coolant', 1, 72, '2026-01-01T08:00:00.000Z'),
      reading('voltage', 1, 12.6, '2026-01-01T08:00:00.000Z'),
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
    readings: [
      reading('speed', 2, 10, '2026-01-01T08:05:00.000Z'),
      reading('coolant', 2, null, '2026-01-01T08:05:00.000Z'),
      reading('voltage', 2, 12.8, '2026-01-01T08:05:00.000Z'),
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
    readings: [
      reading('speed', 3, null, '2026-01-01T08:25:00.000Z'),
      reading('coolant', 3, 76, '2026-01-01T08:25:00.000Z'),
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
    readings: [
      reading('speed', 4, 20, '2026-01-01T08:30:00.000Z'),
      reading('coolant', 4, 78, '2026-01-01T08:30:00.000Z'),
      reading('voltage', 4, 13.1, '2026-01-01T08:30:00.000Z'),
    ],
  },
];

const meta: Meta<MeasurementWorkspace> = {
  title: 'Design System/Patterns/Measurement workspace',
  component: MeasurementWorkspace,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: {
    identity: 'Synthetic measurement selection',
    scopeHint:
      'Four synthetic geographic source records. The channel counts, chart and table use this same loaded selection.',
    channels,
    records,
    selectedChannelKey: null,
    selectedRecordKey: null,
    provenance,
    period,
    coverage,
    loading: false,
    error: null,
    gapThresholdMinutes: 15,
    showMap: true,
  },
  render: (args) => ({
    props: {
      ...args,
      chosenChannel: args.selectedChannelKey ?? null,
      chosenRecord: args.selectedRecordKey ?? null,
    },
    template: `
      <holita-measurement-workspace
        [language]="language"
        [identity]="identity"
        [scopeHint]="scopeHint"
        [channels]="channels"
        [records]="records"
        [selectedChannelKey]="chosenChannel"
        [selectedRecordKey]="chosenRecord"
        [provenance]="provenance"
        [period]="period"
        [coverage]="coverage"
        [loading]="loading"
        [error]="error"
        [gapThresholdMinutes]="gapThresholdMinutes"
        [showMap]="showMap"
        (selectedChannelKeyChange)="chosenChannel = $event"
        (selectedRecordKeyChange)="chosenRecord = $event"
      />
    `,
  }),
};
export default meta;
type Story = StoryObj<MeasurementWorkspace>;

export const Example: Story = {};
export const SelectedReading: Story = {
  args: { selectedChannelKey: 'voltage', selectedRecordKey: 'HOLITA_SCENARIO:synthetic-point-2' },
};
export const NullReading: Story = {
  args: {
    records: records.map((record) =>
      record.id === 'synthetic-point-4'
        ? {
            ...record,
            readings: record.readings.map((value) =>
              value.channelKey === 'coolant' ? { ...value, value: null } : value,
            ),
          }
        : record,
    ),
    selectedChannelKey: 'coolant',
    selectedRecordKey: 'HOLITA_SCENARIO:synthetic-point-4',
  },
};
export const RawSourceUnits: Story = {
  args: {
    channels: [
      {
        key: 'raw',
        id: '539',
        label: 'Synthetic source description',
        unit: null,
        unitConfirmed: false,
        limitation:
          'The source description does not establish units, calibration or counter semantics. No conversion is applied.',
      },
    ],
    records: records.map((record, index) => ({
      ...record,
      key: `KARMA_API:${record.id}`,
      source: 'KARMA_API',
      provenance: {
        ...provenance,
        source: 'KARMA_API',
        origin: 'OBSERVED',
        scenarioId: null,
        sourceRecordId: record.id,
      },
      readings: [
        {
          channelKey: 'raw',
          id: record.id,
          value: index === 2 ? null : index / 100000,
          description: 'Unchanged synthetic source description',
          provenance: {
            ...provenance,
            source: 'KARMA_API',
            origin: 'OBSERVED',
            scenarioId: null,
            sourceRecordId: record.id,
          },
        },
      ],
    })),
    selectedRecordKey: 'KARMA_API:synthetic-point-2',
    provenance: { ...provenance, source: 'KARMA_API', origin: 'OBSERVED', scenarioId: null },
    coverage: { ...coverage, positionCoverage: 'NOT_ASSESSED', gaps: [] },
  },
};
export const Empty: Story = {
  args: { records: [], coverage: { ...coverage, positionsLoaded: 0, gaps: [] } },
};
export const Failed: Story = {
  args: {
    records: null,
    error: 'The bounded measurement request did not complete.',
    provenance: { ...provenance, origin: 'UNAVAILABLE' },
    coverage: {
      ...coverage,
      retrieval: 'UNAVAILABLE',
      positionCoverage: 'NOT_ASSESSED',
      positionsLoaded: 0,
      gaps: [],
    },
  },
};
export const Loading: Story = {
  args: { records: null, provenance: null, coverage: null, loading: true },
};
export const Mobile: Story = {
  args: {
    selectedChannelKey: 'voltage',
    selectedRecordKey: 'HOLITA_SCENARIO:synthetic-point-2',
  },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
