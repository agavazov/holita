import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { onFrame } from '../../../storybook/story-config';
import { injectFleetFormat } from '../format/fleet-format';
import { UI_LANGUAGE } from '../ui-language';
import {
  ChartPanel,
  type ChartPanelKind,
  type ChartPanelPoint,
  type ChartPanelSelection,
  type ChartPanelSeries,
} from './chart-panel';

const storyMessages = {
  en: {
    distance: 'Daily recorded distance',
    distanceSummary:
      'Recorded distance for two vehicle groups, 12–18 October. Zero is measured; gaps are unavailable samples.',
    north: 'North fleet',
    south: 'South fleet',
    live: 'Current connection and reporting state',
    liveSummary:
      'Current snapshot: 18 live vehicles, 7 connected without recent reporting, and 4 disconnected. This is not a historical online count.',
    liveVehicles: 'Live',
    waiting: 'Connected, not reporting',
    disconnected: 'Disconnected',
    vehicles: 'vehicles',
    snapshot: 'Vehicles',
    selected: 'Selected value',
  },
  bg: {
    distance: 'Записано разстояние по дни',
    distanceSummary:
      'Записано разстояние за две групи автомобили, 12–18 октомври. Нулата е измерена; прекъсванията са липсващи проби.',
    north: 'Северен автопарк',
    south: 'Южен автопарк',
    live: 'Текущо състояние на връзката и отчитането',
    liveSummary:
      'Текуща снимка: 18 автомобила на живо, 7 свързани без скорошно отчитане и 4 без връзка. Това не е исторически брой онлайн автомобили.',
    liveVehicles: 'На живо',
    waiting: 'Свързан, без отчитане',
    disconnected: 'Без връзка',
    vehicles: 'автомобила',
    snapshot: 'Автомобили',
    selected: 'Избрана стойност',
  },
};

@Component({
  selector: 'discocan-chart-panel-demo',
  imports: [ChartPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <discocan-chart-panel
      [kind]="kind()"
      [title]="kind() === 'donut' ? text().live : text().distance"
      [summary]="kind() === 'donut' ? text().liveSummary : text().distanceSummary"
      [points]="points()"
      [series]="series()"
      [unit]="kind() === 'donut' ? text().vehicles : 'km'"
      timeZone="Europe/Sofia"
      [period]="kind() === 'donut' ? '' : period()"
      asOf="2026-10-18T07:00:00.000Z"
      [loading]="loading()"
      [drilldown]="true"
      (pointSelect)="selected.set($event)"
    />
    @if (selected(); as selection) {
      <p role="status">
        {{ text().selected }}: {{ selection.series.label }} · {{ selection.point.label }} ·
        {{ selection.value }}
      </p>
    }
  `,
})
class ChartPanelDemo {
  readonly kind = input<ChartPanelKind>('line');
  readonly empty = input(false);
  readonly gaps = input(false);
  readonly loading = input(false);
  protected readonly selected = signal<ChartPanelSelection | null>(null);
  private readonly language = inject(UI_LANGUAGE);
  private readonly format = injectFleetFormat();
  protected readonly text = computed(() => storyMessages[this.language()]);
  protected readonly period = computed(() => this.format.dateRange('2026-10-12', '2026-10-18'));
  protected readonly points = computed<readonly ChartPanelPoint[]>(() => {
    if (this.empty()) {
      return [];
    }
    if (this.kind() === 'donut') {
      return [
        { id: 'live', label: this.text().liveVehicles, tone: 'success' },
        { id: 'waiting', label: this.text().waiting, tone: 'warn' },
        { id: 'disconnected', label: this.text().disconnected, tone: 'neutral' },
      ];
    }
    return Array.from({ length: 7 }, (_value, index) => ({
      id: `2026-10-${String(12 + index)}`,
      label: this.format.dateOnly(`2026-10-${String(12 + index)}`),
    }));
  });
  protected readonly series = computed<readonly ChartPanelSeries[]>(() => {
    if (this.empty()) {
      return [];
    }
    if (this.kind() === 'donut') {
      return [{ id: 'snapshot', label: this.text().snapshot, values: [18, 7, 4] }];
    }
    return [
      {
        id: 'north',
        label: this.text().north,
        values: [348, 412, this.gaps() ? null : 280, 0, 460, 522, 318],
        category: 'c1',
      },
      {
        id: 'south',
        label: this.text().south,
        values: [250, 310, this.gaps() ? null : 360, this.gaps() ? null : 185, 0, 440, 270],
        category: 'c2',
      },
    ];
  });
}

const meta: Meta = {
  title: 'Design System/Charts',
  decorators: [moduleMetadata({ imports: [ChartPanelDemo] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const Donut: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo kind="donut" />' }),
};
export const Line: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo kind="line" />' }),
};
export const Bar: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo kind="bar" />' }),
};
export const Empty: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo [empty]="true" />' }),
};
export const Gaps: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo kind="line" [gaps]="true" />' }),
};
export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => ({ template: '<discocan-chart-panel-demo kind="bar" />' }),
};
export const Loading: Story = {
  render: () => ({ template: '<discocan-chart-panel-demo [loading]="true" />' }),
};
