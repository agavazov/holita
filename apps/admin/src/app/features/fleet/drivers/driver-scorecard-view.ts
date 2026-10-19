import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  StackedBars,
  type StackedLegendItem,
  type StackedRow,
} from '../../../ui/charts/stacked-bars';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { FormatDateTimePipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { PageHeader } from '../../../ui/page-header/page-header';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { driversText } from './i18n/messages';

export const scorecardPeriods = [7, 30, 90] as const;
export type ScorecardPeriod = (typeof scorecardPeriods)[number];
export type DriverScorecardState = 'loading' | 'ready' | 'not-found' | 'error';

export const maneuverKinds = [
  'HARSH_ACCELERATION',
  'HARSH_BRAKING',
  'SPEED_BUMP',
  'OVERTAKING',
  'ROUNDABOUT',
  'LANE_CHANGE',
  'SHARP_TURN',
  'OFF_ROAD',
  'SPEEDING',
] as const;

/** Presentation data from a scorecard; no ranking or scores are derived by the view. */
export interface DriverScorecard {
  readonly name: string;
  readonly employeeNo: string | null;
  readonly asOf: string | null;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly distanceKm: number;
  readonly tripCount: number;
  readonly scoredTripCount: number;
  readonly averageDrivingScore: number | null;
  readonly averageEcoScore: number | null;
  readonly maneuverCount: number;
  readonly maneuversPer100Km: number | null;
  readonly lowConfidence: boolean;
  readonly maneuvers: readonly {
    readonly kind: (typeof maneuverKinds)[number];
    readonly intensity1: number;
    readonly intensity2: number;
    readonly intensity3: number;
    readonly intensityUnknown: number;
    readonly total: number;
  }[];
}

@Component({
  selector: 'holita-driver-scorecard-view',
  imports: [
    RouterLink,
    ButtonDirective,
    Message,
    StackedBars,
    EmptyState,
    FormatDateTimePipe,
    FormatNumberPipe,
    KpiStrip,
    KpiTile,
    PageHeader,
  ],
  templateUrl: './driver-scorecard-view.html',
  styleUrl: './driver-scorecard-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DriverScorecardView {
  readonly state = input.required<DriverScorecardState>();
  readonly scorecard = input<DriverScorecard | null>(null);
  readonly period = input<ScorecardPeriod>(30);
  readonly backLink = input.required<readonly string[]>();
  readonly periodChange = output<ScorecardPeriod>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => driversText(this.language()).scorecard);
  protected readonly periods = scorecardPeriods;
  protected readonly description = computed(() => {
    const employeeNo = this.scorecard()?.employeeNo;
    return employeeNo ? `${this.text().title} · ${employeeNo}` : this.text().title;
  });
  protected readonly coverage = computed(() =>
    interpolate(this.text().coverage, {
      scored: formatNumber(this.scorecard()?.scoredTripCount, this.language()),
      total: formatNumber(this.scorecard()?.tripCount, this.language()),
    }),
  );
  protected readonly maneuverRows = computed<readonly StackedRow[]>(() =>
    (this.scorecard()?.maneuvers ?? []).map((row) => ({
      key: row.kind,
      label: this.text().maneuverKinds[row.kind],
      total: row.total,
      totalText: formatNumber(row.total, this.language()),
      segments: [
        { key: 'intensity1', value: row.intensity1, tone: 'c1' },
        { key: 'intensity2', value: row.intensity2, tone: 'c2' },
        { key: 'intensity3', value: row.intensity3, tone: 'c3' },
        { key: 'intensityUnknown', value: row.intensityUnknown, tone: 'neutral' },
      ],
    })),
  );
  protected readonly legend = computed<readonly StackedLegendItem[]>(() => [
    { key: 'intensity1', label: this.text().intensity1, tone: 'c1' },
    { key: 'intensity2', label: this.text().intensity2, tone: 'c2' },
    { key: 'intensity3', label: this.text().intensity3, tone: 'c3' },
    { key: 'intensityUnknown', label: this.text().intensityUnknown, tone: 'neutral' },
  ]);

  protected periodLabel(days: number): string {
    return interpolate(this.text().days, { days });
  }
}
