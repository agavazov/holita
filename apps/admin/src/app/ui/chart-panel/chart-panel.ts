import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import type { ChartDataSelectEvent } from 'primeng/types/chart';
import { categorySlots, statusToneNames } from '../../theme/status-tones';
import type { Language } from '../../i18n/messages';
import {
  defaultDateFormat,
  type FleetDateFormat,
  formatDateTime,
  formatNumber,
} from '../format/format';
import { interpolate } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';
import type {
  ChartPanelKind,
  ChartPanelPoint,
  ChartPanelSelection,
  ChartPanelSeries,
} from './chart-model';
import { injectChartPalette } from './chart-palette';
import bg from './bg.json';
import en from './en.json';

export type {
  ChartPanelKind,
  ChartPanelPoint,
  ChartPanelSelection,
  ChartPanelSeries,
} from './chart-model';

const messages: Readonly<Record<Language, typeof en>> = { bg, en };

@Component({
  selector: 'holita-chart-panel',
  imports: [ChartModule],
  templateUrl: './chart-panel.html',
  styleUrl: './chart-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-card', '[attr.aria-busy]': 'loading()' },
})
export class ChartPanel {
  readonly kind = input<ChartPanelKind>('line');
  readonly title = input.required<string>();
  readonly points = input<readonly ChartPanelPoint[]>([]);
  readonly series = input<readonly ChartPanelSeries[]>([]);
  readonly unit = input('');
  readonly timeZone = input('UTC');
  readonly dateFormat = input<FleetDateFormat>(defaultDateFormat);
  readonly period = input('');
  readonly asOf = input<string | null>(null);
  readonly summary = input('');
  readonly loading = input(false);
  readonly drilldown = input(false);
  readonly pointSelect = output<ChartPanelSelection>();

  private readonly language = inject(UI_LANGUAGE);
  private readonly theme = injectChartPalette(inject<ElementRef<HTMLElement>>(ElementRef));
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly palette = this.theme.palette;
  protected readonly chartType = computed(() => {
    const kind = this.kind();
    return kind === 'donut' ? 'doughnut' : kind;
  });
  protected readonly hasData = computed(() =>
    this.points().some((_point, index) =>
      this.series().some((series) => series.values[index] != null),
    ),
  );
  protected readonly summaryText = computed(
    () =>
      this.summary() ||
      interpolate(this.text().summary, {
        points: this.points().length,
        series: this.series().length,
      }),
  );
  protected readonly asOfText = computed(() =>
    formatDateTime(this.asOf(), this.language(), this.timeZone(), false, this.dateFormat()),
  );
  protected readonly legend = computed(() => {
    const items = this.kind() === 'donut' ? this.points() : this.series();
    return items.map((item, index) => ({
      id: item.id,
      label: item.label,
      color: this.color(item, index),
    }));
  });
  protected readonly chartData = computed<ChartData>(() => ({
    labels: this.points().map((point) => point.label),
    datasets: this.series().map((series, index) => ({
      label: series.label,
      data: this.points().map((_point, pointIndex) => series.values[pointIndex] ?? null),
      backgroundColor:
        this.kind() === 'donut'
          ? this.points().map((point, pointIndex) => this.color(point, pointIndex))
          : this.color(series, index),
      borderColor: this.kind() === 'donut' ? this.palette()?.background : this.color(series, index),
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: false,
      tension: 0,
    })),
  }));
  protected readonly chartOptions = computed<ChartOptions>(() => {
    const palette = this.palette();
    const shared: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: this.theme.reducedMotion() ? false : { duration: 180 },
      color: palette?.text,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette?.background,
          titleColor: palette?.text,
          bodyColor: palette?.text,
          borderColor: palette?.border,
          borderWidth: 1,
          callbacks: {
            label: (context) =>
              `${context.dataset.label ?? ''}: ${this.valueText(this.series()[context.datasetIndex]?.values[context.dataIndex] ?? null)}`,
          },
        },
      },
    };
    return this.kind() === 'donut'
      ? { ...shared, cutout: '65%' }
      : {
          ...shared,
          scales: {
            x: { grid: { display: false }, ticks: { color: palette?.muted, maxRotation: 0 } },
            y: {
              beginAtZero: true,
              grid: { color: palette?.border },
              ticks: { color: palette?.muted, callback: (value) => this.valueText(Number(value)) },
            },
          },
        };
  });

  protected valueText(value: number | null | undefined): string {
    if (value == null) {
      return this.text().gap;
    }
    const number = formatNumber(value, this.language(), { fraction: 2 });
    return this.unit() ? `${number} ${this.unit()}` : number;
  }

  protected actionLabel(
    series: ChartPanelSeries,
    point: ChartPanelPoint,
    value: number | null | undefined,
  ): string {
    return interpolate(this.text().open, {
      series: series.label,
      point: point.label,
      value: this.valueText(value),
    });
  }

  protected chartSelect(event: ChartDataSelectEvent): void {
    const element = event.element;
    if (
      typeof element !== 'object' ||
      element === null ||
      !('index' in element) ||
      !('datasetIndex' in element)
    ) {
      return;
    }
    if (typeof element.index === 'number' && typeof element.datasetIndex === 'number') {
      this.select(element.datasetIndex, element.index);
    }
  }

  protected select(seriesIndex: number, pointIndex: number): void {
    const point = this.points()[pointIndex];
    const series = this.series()[seriesIndex];
    const value = series?.values[pointIndex];
    if (this.drilldown() && point && series && value != null) {
      this.pointSelect.emit({ point, series, value, pointIndex, seriesIndex });
    }
  }

  private color(item: ChartPanelPoint | ChartPanelSeries, index: number): string {
    const palette = this.palette();
    if (!palette) {
      return '';
    }
    return item.tone
      ? (palette.tones[statusToneNames.indexOf(item.tone)] ?? palette.text)
      : (palette.categories[
          item.category ? categorySlots.indexOf(item.category) : index % categorySlots.length
        ] ?? palette.text);
  }
}
