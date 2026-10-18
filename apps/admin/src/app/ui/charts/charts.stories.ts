import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
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
    valueText: value === null ? 'няма данни' : `${String(value)} км`,
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
          <div class="app-card__header"><h2 class="app-card__title">Пробег по дни</h2></div>
          <holita-column-series label="Пробег по дни, последни 14 дни" [points]="days" />
        </section>
        <section class="app-card">
          <div class="app-card__header"><h2 class="app-card__title">Маневри</h2></div>
          <holita-stacked-bars
            label="Маневри по превозни средства"
            [rows]="maneuvers"
            [legend]="[{ key: 'braking', label: 'Рязко спиране', tone: 'danger' }, { key: 'acceleration', label: 'Рязко ускорение', tone: 'warn' }, { key: 'turns', label: 'Остри завои', tone: 'c4' }]"
          />
        </section>
        <section class="app-card">
          <div class="app-card__header"><h2 class="app-card__title">Скорост, 48 ч</h2></div>
          <holita-sparkline label="Скорост, последни 48 ч" [points]="speed" [from]="0" [to]="48 * hour" unit="км/ч" />
        </section>
      </div>
    `,
  }),
};
