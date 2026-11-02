import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import type {
  AdminKarmaDailyReportQuery,
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { formatDateOnly, formatNumber } from '../../../ui/format/format';
import { toneSeverity, type StatusTone } from '../../../ui/tones';
import { SourceContext } from '../../../ui/source-context/source-context';
import bg from './bg.json';
import en from './en.json';

type DailyReport = AdminKarmaDailyReportQuery['karmaDailyReport'];
type Metric = DailyReport['tripCount'];

const catalogs: Record<Language, typeof en> = { bg, en };
const stateTones: Record<DailyReport['state'], StatusTone> = {
  COMPLETE: 'info',
  EMPTY: 'neutral',
  PARTIAL: 'warn',
  UNSUPPORTED_PERIOD: 'neutral',
  UNAVAILABLE: 'danger',
};

/** Read-only contract presentation; the owning feature supplies data and handles retries. */
@Component({
  selector: 'holita-daily-report-coverage',
  imports: [ButtonDirective, Message, Tag, SourceContext],
  templateUrl: './daily-report-coverage.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.lang]': 'language()' },
})
export class DailyReportCoverage {
  readonly language = input.required<Language>();
  readonly report = input.required<DailyReport>();
  readonly loading = input(false);
  readonly retry = output();
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly day = computed(() => formatDateOnly(this.report().day, this.language()));
  protected readonly severity = computed(() => toneSeverity(stateTones[this.report().state]));
  protected readonly canRetry = computed(
    () => this.report().state === 'PARTIAL' || this.report().state === 'UNAVAILABLE',
  );
  protected readonly provenance = computed<FleetEvidenceFragment>(() => ({
    origin:
      this.report().state === 'UNAVAILABLE' || this.report().state === 'UNSUPPORTED_PERIOD'
        ? 'UNAVAILABLE'
        : 'DERIVED',
    source: 'KARMA_API',
    scenarioId: null,
    sourceRecordId: null,
    eventAt: null,
    receivedAt: null,
    retrievedAt: this.report().retrievedAt,
  }));
  protected readonly period = computed<FleetEvidencePeriodFragment | null>(() => {
    const { fromUtc, toUtcExclusive, timeZone } = this.report();
    return fromUtc && toUtcExclusive && timeZone
      ? { from: fromUtc, toExclusive: toUtcExclusive, timeZone: timeZone.name }
      : null;
  });
  protected readonly coverage = computed<FleetScenarioCoverageFragment>(() => ({
    retrieval: this.report().retrieval,
    positionCoverage: this.report().positionCoverage,
    positionsLoaded: 0,
    gaps: [],
  }));
  protected readonly metrics = computed(() => [
    { key: 'tripCount', label: this.text().tripCount, metric: this.report().tripCount },
    { key: 'totalDistance', label: this.text().totalDistance, metric: this.report().totalDistance },
    { key: 'dayDistance', label: this.text().dayDistance, metric: this.report().dayDistance },
    { key: 'nightDistance', label: this.text().nightDistance, metric: this.report().nightDistance },
    { key: 'maxSpeed', label: this.text().maxSpeed, metric: this.report().maxSpeed },
  ]);

  protected value(metric: Metric): string {
    return formatNumber(metric.value, this.language(), { significantDigits: 15 });
  }
}
