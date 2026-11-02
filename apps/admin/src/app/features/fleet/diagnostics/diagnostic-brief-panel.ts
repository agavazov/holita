import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import type { Language } from '../../../i18n/messages';
import { downloadJson } from '../../../ui/download-json';
import { FormField } from '../../../ui/form-field/form-field';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { SourceContext } from '../../../ui/source-context/source-context';
import { eligibleBriefPoints, faultBrief, riskBrief } from './diagnostic-brief';
import { attentionText, DiagnosticsReview } from './diagnostics-review';
import type { DiagnosticScenario, Fault } from './fault-mapping';
import type { DiagnosticEvaluation } from './risk-mapping';
import bg from './risk.bg.json';
import en from './risk.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-diagnostic-brief-panel',
  imports: [JsonPipe, FormsModule, ButtonDirective, Select, FormField, SourceContext],
  templateUrl: './diagnostic-brief-panel.html',
  styleUrl: './diagnostic-brief-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticBriefPanel {
  readonly scenario = input.required<DiagnosticScenario>();
  readonly fault = input<Fault | null>(null);
  readonly evaluation = input<DiagnosticEvaluation | null>(null);
  readonly language = input.required<Language>();
  private readonly review = inject(DiagnosticsReview);
  protected readonly text = computed(() => attentionText[this.language()]);
  protected readonly evidenceText = computed(() => catalogs[this.language()]);
  protected readonly kind = computed(() => (this.fault() ? 'fault' : 'risk'));
  protected readonly record = computed(() => this.fault() ?? this.evaluation());
  protected readonly selectedPointId = linkedSignal({
    source: () => this.record()?.id,
    computation: () => '',
  });
  protected readonly localStatus = computed(() => {
    const record = this.record();
    return record ? this.review.status(this.kind(), record.id) : 'UNREVIEWED';
  });
  protected readonly points = computed(() => {
    const record = this.record();
    return record ? eligibleBriefPoints(this.scenario(), this.kind(), record.id) : [];
  });
  protected readonly pointOptions = computed(() => [
    { value: '', label: this.text().withoutCoordinates },
    ...this.points().map((point) => ({
      value: point.id,
      label: `${point.id} · ${this.time(point.eventAt)}`,
    })),
  ]);
  protected readonly faultExport = computed(() => {
    const fault = this.fault();
    return fault
      ? faultBrief(this.scenario(), fault, this.localStatus(), this.selectedPointId() || undefined)
      : null;
  });
  protected readonly riskExport = computed(() => {
    const evaluation = this.evaluation();
    return evaluation
      ? riskBrief(
          this.scenario(),
          evaluation,
          this.localStatus(),
          this.selectedPointId() || undefined,
        )
      : null;
  });
  protected readonly brief = computed(() => this.faultExport() ?? this.riskExport());
  protected readonly facts = computed(() => {
    const fault = this.fault();
    const evaluation = this.evaluation();
    const text = this.evidenceText();
    return fault
      ? [
          { label: text.faultId, value: fault.id },
          { label: text.reportedStatus, value: text.statuses[fault.reportedStatus] },
          {
            label: attentionText[this.language()].occurrences,
            value: this.number(fault.occurrences),
          },
        ]
      : evaluation
        ? [
            { label: text.evaluationId, value: evaluation.id },
            { label: text.rule, value: text.rules[evaluation.rule] },
            {
              label: text.version,
              value: `${evaluation.ruleId} · ${this.number(evaluation.version)}`,
            },
            {
              label: text.result,
              value: `${text.states[evaluation.state]} · ${evaluation.attention ? text.attentionLabels[evaluation.attention] : text.attentionNone}`,
            },
            { label: text.windowFrom, value: this.time(evaluation.window.from) },
            { label: text.windowTo, value: this.time(evaluation.window.toExclusive) },
            {
              label: text.availableInputs,
              value: `${this.number(evaluation.availableInputs)}/${this.number(evaluation.requiredInputs)}`,
            },
            {
              label: text.thresholds,
              value: evaluation.thresholds
                .map(
                  (threshold) =>
                    `${text.thresholdKinds[threshold.kind]} ${this.number(threshold.value)} ${threshold.unit ? text.units[threshold.unit] : ''}`,
                )
                .join('; '),
            },
            { label: text.evaluatedAt, value: this.time(evaluation.evaluatedAt) },
            {
              label: text.missingEvidence,
              value:
                evaluation.missingEvidence
                  .map((reason) => text.missingEvidenceLabels[reason])
                  .join(' ') || text.noMissingEvidenceReported,
            },
          ]
        : [];
  });
  protected readonly evidence = computed(() => {
    const text = this.evidenceText();
    const fault = this.faultExport();
    if (fault) {
      return fault.observations.map((reference) => ({
        id: reference.id,
        time: this.time(reference.record?.provenance.eventAt),
        detail: reference.record
          ? `${text.logKinds[reference.record.kind]} · ${reference.record.reportedStatus ? text.statuses[reference.record.reportedStatus] : ''}`
          : text.referenceUnavailable,
      }));
    }
    const risk = this.riskExport();
    return risk
      ? [
          ...[...risk.contributingSignals, ...risk.missingInputs].map((reference) => ({
            id: reference.id,
            time: this.time(reference.record?.provenance.eventAt),
            detail: reference.record
              ? `${text.signals[reference.record.signal]} · ${reference.record.value === null ? text.valueUnavailable : `${this.number(reference.record.value)} ${text.units[reference.record.unit]}`} · ${text.availabilityStates[reference.record.availability]}`
              : text.referenceUnavailable,
          })),
          ...risk.contributingLogs.map((reference) => ({
            id: reference.id,
            time: this.time(reference.record?.provenance.eventAt),
            detail: reference.record
              ? text.logKinds[reference.record.kind]
              : text.referenceUnavailable,
          })),
        ]
      : [];
  });
  protected time(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.scenario().period.timeZone, true);
  }
  private number(value: number): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
  protected choosePoint(value: unknown): void {
    if (
      typeof value === 'string' &&
      (!value || this.points().some((point) => point.id === value))
    ) {
      this.selectedPointId.set(value);
    }
  }
  protected download(): void {
    const brief = this.brief();
    const record = this.record();
    if (brief && record) {
      downloadJson(`${this.kind()}-${record.id}-brief.json`, brief);
    }
  }
}
