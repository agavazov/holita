import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, type UrlTree } from '@angular/router';
import { Tag } from 'primeng/tag';
import type { Language } from '../../../i18n/messages';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { SourceContext } from '../../../ui/source-context/source-context';
import type { DiagnosticScenario } from './fault-mapping';
import { logEvaluation, logFault, logSignal, type DiagnosticLog } from './log-mapping';
import type { DiagnosticEvaluation } from './risk-mapping';
import riskBg from './risk.bg.json';
import riskEn from './risk.en.json';
import bg from './vehicle-summary.bg.json';
import en from './vehicle-summary.en.json';
import sourceBg from './bg.json';
import sourceEn from './en.json';
import { vehicleSummaryData } from './vehicle-summary-mapping';

const catalogs: Record<Language, typeof en> = { bg, en };
const sourceCatalogs: Record<Language, typeof sourceEn> = { bg: sourceBg, en: sourceEn };
const riskCatalogs: Record<Language, typeof riskEn> = { bg: riskBg, en: riskEn };

@Component({
  selector: 'holita-vehicle-summary',
  imports: [RouterLink, SourceContext, Tag],
  templateUrl: './vehicle-summary.html',
  styleUrl: './vehicle-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-stack', '[attr.lang]': 'language()' },
})
export class VehicleSummary {
  readonly scenario = input.required<DiagnosticScenario>();
  readonly vehicleId = input.required<string>();
  readonly conditions = input<readonly FilterCondition[]>([]);
  readonly language = input.required<Language>();
  readonly logLink = input.required<(id: string) => UrlTree>();
  readonly faultLink = input.required<(id: string) => UrlTree>();
  readonly riskLink = input.required<(id: string) => UrlTree>();

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly sourceExplanation = computed(
    () => sourceCatalogs[this.language()].exampleInfo,
  );
  protected readonly riskText = computed(() => riskCatalogs[this.language()]);
  protected readonly data = computed(() =>
    vehicleSummaryData(this.scenario(), this.vehicleId(), this.conditions()),
  );
  protected readonly selection = computed(() => {
    const data = this.data();
    return `${data.selectedFrom ? this.time(data.selectedFrom) : this.text().openStart} – ${data.selectedTo ? this.time(data.selectedTo) : this.text().openEnd}`;
  });

  protected missingEvidence(evaluation: DiagnosticEvaluation): string {
    return (
      evaluation.missingEvidence
        .map((missing) => this.riskText().compactMissingEvidence[missing])
        .join('; ') || this.text().noMissingEvidence
    );
  }

  protected logLabel(log: DiagnosticLog): string {
    const text = this.text();
    const sample = logSignal(this.scenario(), log);
    const evaluation = logEvaluation(this.scenario(), log);
    const fault = logFault(this.scenario(), log);
    return sample
      ? `${text.logKinds[log.kind]} · ${text.signals[sample.signal]} · ${sample.value === null ? text.unavailable : `${this.number(sample.value)} ${text.units[sample.unit]}`}`
      : evaluation
        ? `${this.riskText().rules[evaluation.rule]} · ${this.riskText().states[evaluation.state]}`
        : `${text.logKinds[log.kind]}${fault ? ` · ${text.codes[fault.code]}` : ''}${log.reportedStatus ? ` · ${text.statuses[log.reportedStatus]}` : ''}`;
  }

  protected time(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.scenario().period.timeZone);
  }

  protected number(value: number | null | undefined): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
}
