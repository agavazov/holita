import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { Language } from '../../../i18n/messages';
import { downloadJson } from '../../../ui/download-json';
import { formatDateOnly } from '../../../ui/format/format';
import { SourceContext } from '../../../ui/source-context/source-context';
import {
  dailyReportMessages,
  dailyReportPresentation,
  type DailyReportResult,
} from './daily-report-presentation';
import { dayEvidence, reportBrief, reportComparison } from './report-evidence';
import bg from './report-review.bg.json';
import en from './report-review.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };
let nextId = 0;

@Component({
  selector: 'holita-report-review',
  imports: [ButtonDirective, Message, SourceContext, TableModule],
  templateUrl: './report-review.html',
  styleUrl: './report-review.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '[attr.lang]': 'language()' },
})
export class ReportReview {
  readonly language = input.required<Language>();
  readonly report = input.required<DailyReportResult>();
  readonly baseline = input<DailyReportResult | null>(null);
  readonly comparisonLoading = input(false);
  readonly comparisonError = input(false);
  readonly viewTrip = output<{ day: string; id: string }>();
  readonly retryComparison = output();

  protected readonly id = `report-review-${String(nextId++)}`;
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly sourceText = computed(() => dailyReportMessages[this.language()]);
  protected readonly selectedPresentation = computed(() =>
    dailyReportPresentation(this.report(), this.language()),
  );
  protected readonly baselinePresentation = computed(() => {
    const report = this.baseline();
    return report ? dailyReportPresentation(report, this.language()) : null;
  });
  protected readonly comparison = computed(() => {
    const baseline = this.baseline();
    return baseline ? [...reportComparison(this.report(), baseline, this.language())] : [];
  });
  protected readonly selectedBrief = computed(() => reportBrief(this.report(), this.language()));
  protected readonly baselineBrief = computed(() => {
    const report = this.baseline();
    return report ? reportBrief(report, this.language()) : [];
  });
  protected readonly includeCoordinates = linkedSignal<DailyReportResult, boolean>({
    source: () => this.report(),
    computation: (report, previous) =>
      previous && report.carId === previous.source.carId && report.day === previous.source.day
        ? previous.value
        : false,
  });
  protected readonly includeBaseline = linkedSignal(() => {
    this.baseline();
    return false;
  });

  protected day(value: string | null): string {
    return formatDateOnly(value, this.language());
  }

  protected openTrip(report: DailyReportResult, id: string): void {
    if (report.day) {
      this.viewTrip.emit({ day: report.day, id });
    }
  }

  protected changeCoordinates(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.includeCoordinates.set(input.checked);
    }
  }

  protected changeBaseline(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.includeBaseline.set(input.checked);
    }
  }

  protected download(): void {
    const report = this.report();
    downloadJson(
      `holita-day-evidence-${report.day ?? 'unavailable'}.json`,
      dayEvidence(
        report,
        this.includeBaseline() ? this.baseline() : null,
        this.language(),
        this.includeCoordinates(),
      ),
    );
  }
}
