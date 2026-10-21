import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { onFrame } from '../../../storybook/story-config';
import { ColumnSeries, type SeriesPoint } from './column-series';
import { Sparkline, type SparkPoint } from './sparkline';
import { StackedBars, type StackedRow } from './stacked-bars';

const days: readonly SeriesPoint[] = Array.from({ length: 14 }, (_, index) => {
  const value = index === 9 ? null : index === 4 ? 0 : 900 + ((index * 337) % 700);
  const day = String(5 + index).padStart(2, '0');
  return {
    key: day,
    label: `${day}.10`,
    value,
    valueText: value === null ? 'no data' : `${String(value)} km`,
  };
});

const maneuvers: readonly StackedRow[] = [
  {
    key: 'v1',
    label: 'CB 1001 AX',
    total: 14,
    totalText: '14',
    segments: [
      { key: 'braking', value: 6, tone: 'danger' },
      { key: 'acceleration', value: 5, tone: 'warn' },
      { key: 'turns', value: 3, tone: 'c4' },
    ],
  },
  {
    key: 'v2',
    label: 'CB 1002 AX',
    total: 9,
    totalText: '9',
    segments: [
      { key: 'braking', value: 2, tone: 'danger' },
      { key: 'acceleration', value: 4, tone: 'warn' },
      { key: 'turns', value: 3, tone: 'c4' },
    ],
  },
  {
    key: 'v3',
    label: 'CB 1003 AX',
    total: 3,
    totalText: '3',
    segments: [{ key: 'turns', value: 3, tone: 'c4' }],
  },
];

const hour = 3_600_000;
const speed: readonly SparkPoint[] = Array.from({ length: 49 }, (_, index) => ({
  at: index * hour,
  value: index >= 18 && index <= 24 ? null : Math.round(48 + 40 * Math.sin(index / 3)),
}));

const meta: Meta = {
  title: 'Design System/Patterns/Charts',
  decorators: [moduleMetadata({ imports: [ColumnSeries, StackedBars, Sparkline] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const Charts: Story = {
  render: () => ({
    props: { days, maneuvers, speed, hour },
    template: `
      <div class="app-card-grid">
        <section class="app-card">
          <div class="app-card__header"><h2 class="app-card__title">Daily mileage</h2></div>
          <holita-column-series label="Daily mileage, last 14 days" [points]="days" />
        </section>
        <section class="app-card">
          <div class="app-card__header"><h2 class="app-card__title">Maneuvers</h2></div>
          <holita-stacked-bars
            label="Maneuvers by vehicle"
            [rows]="maneuvers"
            [legend]="[{ key: 'braking', label: 'Harsh braking', tone: 'danger' }, { key: 'acceleration', label: 'Harsh acceleration', tone: 'warn' }, { key: 'turns', label: 'Sharp turns', tone: 'c4' }]"
          />
        </section>
        <section class="app-card">
          <div class="app-card__header"><h2 class="app-card__title">Speed, 48 h</h2></div>
          <holita-sparkline label="Speed, last 48 h" [points]="speed" [from]="0" [to]="48 * hour" unit="km/h" />
        </section>
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('table', { name: 'Daily mileage, last 14 days' }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole('table', { name: 'Maneuvers by vehicle' })).toBeInTheDocument();
    await waitFor(() => {
      const root = canvasElement.ownerDocument.documentElement;
      return expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    });
  },
};
