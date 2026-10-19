import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import type { StatusTone } from '../../../theme/status-tones';
import { ColumnSeries, type SeriesPoint } from '../../../ui/charts/column-series';
import {
  type StackedLegendItem,
  StackedBars,
  type StackedRow,
} from '../../../ui/charts/stacked-bars';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import {
  displayTimeZone,
  FormatDateTimePipe,
  FormatNumberPipe,
} from '../../../ui/format/format.pipes';
import { formatDateTime } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { PageHeader } from '../../../ui/page-header/page-header';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { TripRow } from '../trips/trips-view';
import { overviewText } from './i18n/messages';

export interface OverviewKpis {
  readonly moving: number;
  readonly active: number;
  readonly distanceTodayKm: number;
  readonly criticalAlerts: number;
  readonly overdueService: number;
  readonly notReporting: number;
}

/** One line of "Needs attention": what, where, and the page that handles it. */
export interface AttentionItem {
  readonly key: string;
  readonly tone: StatusTone;
  readonly title: string;
  readonly detail: string;
  readonly link: readonly string[];
  readonly queryParams?: Readonly<Record<string, string>>;
}

/** Where the dashboard links to; the host knows its routes. */
export interface OverviewLinks {
  readonly vehicles: readonly string[];
  readonly alerts: readonly string[];
  readonly maintenance: readonly string[];
  readonly trips: readonly string[];
}

export type OverviewState = 'loading' | 'ready' | 'error';

/**
 * The Fleet dashboard: KPI tiles that link to the lists behind them, the items that need
 * attention, distance per day, activity by group and the latest trips. Presentation only.
 */
@Component({
  selector: 'holita-overview-view',
  imports: [
    RouterLink,
    ButtonDirective,
    Skeleton,
    ColumnSeries,
    StackedBars,
    EmptyState,
    FormatDateTimePipe,
    FormatNumberPipe,
    KpiStrip,
    KpiTile,
    PageHeader,
  ],
  templateUrl: './overview-view.html',
  styleUrl: './overview-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class OverviewView {
  readonly state = input.required<OverviewState>();
  readonly branchName = input.required<string>();
  readonly dataAsOf = input.required<string>();
  readonly links = input.required<OverviewLinks>();
  readonly kpis = input<OverviewKpis | null>(null);
  readonly attention = input<readonly AttentionItem[]>([]);
  readonly distance = input<readonly SeriesPoint[]>([]);
  readonly activity = input<readonly StackedRow[]>([]);
  readonly trips = input<readonly TripRow[]>([]);
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => overviewText(this.language()));
  protected readonly description = computed(() =>
    interpolate(this.text().description, {
      branch: this.branchName(),
      asOf: formatDateTime(this.dataAsOf(), this.language(), displayTimeZone),
    }),
  );
  protected readonly legend = computed<readonly StackedLegendItem[]>(() => {
    const text = this.text().activity;
    return [
      { key: 'moving', label: text.moving, tone: 'success' },
      { key: 'idle', label: text.idle, tone: 'info' },
      { key: 'parked', label: text.parked, tone: 'muted' },
      { key: 'notReporting', label: text.notReporting, tone: 'danger' },
      { key: 'asset', label: text.asset, tone: 'c1' },
      { key: 'noDevice', label: text.noDevice, tone: 'c2' },
    ];
  });
  protected readonly placeholders = [1, 2, 3, 4];

  protected movingSecondary(active: number): string {
    return interpolate(this.text().kpis.movingSecondary, { active });
  }

  protected dotClass(item: AttentionItem): string {
    return `app-dot app-dot--${item.tone}`;
  }
}
