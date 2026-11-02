import type { SourceProvenance, SourcePeriod, SourceCoverage } from './source-types';
import type { Meta, StoryObj } from '@storybook/angular-vite';

import { onFrame } from '../../../storybook/story-config';
import { SourceContext } from './source-context';

// Story-only snapshots; they do not read account data or the product data.
const observed: SourceProvenance = {
  origin: 'OBSERVED',
  source: 'KARMA_API',
  sourceRecordId: 'synthetic-source-record-1',
  eventAt: '2026-01-01T09:59:00.000Z',
  receivedAt: null,
  retrievedAt: '2026-01-01T10:00:00.000Z',
};

const period: SourcePeriod = {
  from: '2026-01-01T08:00:00.000Z',
  toExclusive: '2026-01-01T10:00:00.000Z',
  timeZone: 'Europe/Sofia',
};

const coverage: SourceCoverage = {
  retrieval: 'COMPLETE',
  positionCoverage: 'NOT_ASSESSED',
  positionsLoaded: 12,
  gaps: [],
};

const partialCoverage: SourceCoverage = {
  retrieval: 'PARTIAL',
  positionCoverage: 'PARTIAL',
  positionsLoaded: 8,
  gaps: [{ from: '2026-01-01T08:30:00.000Z', toExclusive: '2026-01-01T08:50:00.000Z' }],
};

const meta: Meta<SourceContext> = {
  title: 'Design System/Patterns/Source context',
  component: SourceContext,
  decorators: [onFrame],
  tags: ['!autodocs'],
  args: { provenance: observed, period, coverage, availability: 'COMPLETE' },
};
export default meta;
type Story = StoryObj<SourceContext>;

export const Observed: Story = {};
export const DerivedReal: Story = {
  args: {
    provenance: {
      ...observed,
      origin: 'DERIVED',
      sourceRecordId: 'synthetic-report-1',
      eventAt: null,
    },
  },
};
export const Unavailable: Story = {
  args: {
    provenance: { ...observed, origin: 'UNAVAILABLE', sourceRecordId: null, eventAt: null },
    coverage: { ...coverage, retrieval: 'UNAVAILABLE', positionsLoaded: 0 },
    availability: 'UNAVAILABLE',
  },
};
export const PartialWithGaps: Story = {
  args: { provenance: observed, coverage: partialCoverage, availability: 'PARTIAL' },
};
export const Mobile: Story = {
  ...PartialWithGaps,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Compact: Story = { args: { compact: true } };
