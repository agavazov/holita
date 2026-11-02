import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, type UrlTree } from '@angular/router';
import { Tag } from 'primeng/tag';
import type { FleetScenarioRuleEvaluationDetailsFragment } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { SourceContext } from '../../../ui/source-context/source-context';
import { toneSeverity } from '../../../ui/tones';
import type { DiagnosticScenario } from './fault-mapping';
import bg from './risk.bg.json';
import en from './risk.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-risk-evidence',
  imports: [RouterLink, SourceContext, Tag],
  templateUrl: './risk-evidence.html',
  styleUrl: './risk-evidence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-stack',
    '[attr.lang]': 'language()',
    '[class.risk-evidence--compact]': 'compact()',
  },
})
export class RiskEvidence {
  readonly scenario = input.required<DiagnosticScenario>();
  readonly evaluation = input.required<FleetScenarioRuleEvaluationDetailsFragment>();
  readonly language = input.required<Language>();
  readonly logLink = input.required<(id: string) => UrlTree>();
  readonly faultLink = input<UrlTree | null>(null);
  readonly compact = input(false);

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly attentionSeverity = computed(() =>
    toneSeverity(this.evaluation().attention === 'REVIEW' ? 'warn' : 'neutral'),
  );
  protected readonly vehicleLabel = computed(
    () =>
      this.scenario().vehicles.find((vehicle) => vehicle.id === this.evaluation().vehicleId)
        ?.label ?? this.evaluation().vehicleId,
  );
  protected readonly fault = computed(() => {
    const evaluation = this.evaluation();
    return (
      this.scenario().faults.find(
        (fault) =>
          fault.id === evaluation.faultId &&
          fault.vehicleId === evaluation.vehicleId &&
          fault.provenance.source === evaluation.provenance.source &&
          fault.provenance.scenarioId === evaluation.provenance.scenarioId,
      ) ?? null
    );
  });
  protected readonly ruleFacts = computed(() => {
    const evaluation = this.evaluation();
    const text = this.text();
    return [
      { label: text.rule, value: text.rules[evaluation.rule] },
      { label: text.ruleId, value: evaluation.ruleId },
      { label: text.version, value: this.number(evaluation.version) },
      { label: text.vehicle, value: this.vehicleLabel() },
      { label: text.windowFrom, value: this.time(evaluation.window.from) },
      { label: text.windowTo, value: this.time(evaluation.window.toExclusive) },
      { label: text.availableInputs, value: this.number(evaluation.availableInputs) },
      { label: text.requiredInputs, value: this.number(evaluation.requiredInputs) },
    ];
  });
  protected readonly clockFacts = computed(() => {
    const evaluation = this.evaluation();
    const text = this.text();
    return [
      { label: text.evaluatedAt, value: this.time(evaluation.evaluatedAt) },
      { label: text.retrievedAt, value: this.time(evaluation.provenance.retrievedAt) },
      { label: text.exampleClock, value: this.time(this.scenario().exampleClock) },
      { label: text.timeZone, value: evaluation.window.timeZone },
    ];
  });
  protected readonly identityFacts = computed(() => {
    const evaluation = this.evaluation();
    const text = this.text();
    return [
      { label: text.evaluationId, value: evaluation.id },
      { label: text.vehicleId, value: evaluation.vehicleId },
      { label: text.tripId, value: evaluation.tripId },
      { label: text.sourceEventAt, value: this.time(evaluation.provenance.eventAt) },
      { label: text.receivedAt, value: this.time(evaluation.provenance.receivedAt) },
    ];
  });
  protected readonly signalEvidence = computed(() => {
    const evaluation = this.evaluation();
    return [
      ...evaluation.contributingSignalIds.map((id) => ({ id, missing: false })),
      ...evaluation.missingSignalIds.map((id) => ({ id, missing: true })),
    ]
      .map((reference) => {
        const sample = this.scenario().signalSamples.find(
          (sample) =>
            sample.id === reference.id &&
            sample.vehicleId === evaluation.vehicleId &&
            sample.tripId === evaluation.tripId &&
            sample.provenance.source === evaluation.provenance.source &&
            sample.provenance.scenarioId === evaluation.provenance.scenarioId,
        );
        const log = sample
          ? this.scenario().logs.find(
              (log) =>
                log.kind === 'MEASUREMENT' &&
                log.signalSampleId === sample.id &&
                log.vehicleId === sample.vehicleId &&
                log.tripId === sample.tripId &&
                log.provenance.source === sample.provenance.source &&
                log.provenance.scenarioId === sample.provenance.scenarioId,
            )
          : null;
        return { ...reference, sample: sample ?? null, log: log ?? null };
      })
      .sort((left, right) =>
        (left.sample?.provenance.eventAt ?? '\uffff').localeCompare(
          right.sample?.provenance.eventAt ?? '\uffff',
        ),
      );
  });
  protected readonly logEvidence = computed(() => {
    const evaluation = this.evaluation();
    return evaluation.contributingLogIds.map((id) => ({
      id,
      log:
        this.scenario().logs.find(
          (log) =>
            log.id === id &&
            log.vehicleId === evaluation.vehicleId &&
            log.tripId === evaluation.tripId &&
            log.provenance.source === evaluation.provenance.source &&
            log.provenance.scenarioId === evaluation.provenance.scenarioId,
        ) ?? null,
    }));
  });
  protected readonly compactWindow = computed(() => {
    const evaluation = this.evaluation();
    const from = formatDateTime(
      evaluation.window.from,
      this.language(),
      evaluation.window.timeZone,
    );
    const to = formatDateTime(
      evaluation.window.toExclusive,
      this.language(),
      evaluation.window.timeZone,
    );
    return `[${from} – ${to})`;
  });
  protected readonly compactFacts = computed(() => {
    const text = this.text();
    const evaluation = this.evaluation();
    const references = this.signalEvidence();
    const firstSample = references[0]?.sample;
    if (references.length) {
      const values = references
        .map(({ sample }) =>
          sample
            ? `${sample.value === null ? text.compactUnavailable : `${this.number(sample.value)} ${text.units[sample.unit]}`} (${this.clock(sample.provenance.eventAt)})`
            : text.compactRecordUnavailable,
        )
        .join(' → ');
      return `${firstSample ? text.compactSignals[firstSample.signal] : text.compactInputs}: ${values} · ${this.number(evaluation.availableInputs)}/${this.number(evaluation.requiredInputs)} ${text.compactUsableInputs}`;
    }
    const times = this.logEvidence()
      .map(({ log }) => (log ? this.clock(log.provenance.eventAt) : text.compactRecordUnavailable))
      .join(', ');
    return times
      ? `${this.number(evaluation.availableInputs)} ${text.compactReports} (${times})`
      : text.noContributors;
  });
  protected readonly compactThresholds = computed(() =>
    this.evaluation()
      .thresholds.map(
        (threshold) =>
          `${this.text().compactThresholdKinds[threshold.kind]} ${this.number(threshold.value)}${threshold.unit ? ` ${this.text().units[threshold.unit]}` : ''}`,
      )
      .join('; '),
  );
  protected readonly compactMissing = computed(() =>
    this.evaluation()
      .missingEvidence.map((missing) => this.text().compactMissingEvidence[missing])
      .join('; '),
  );

  private clock(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.evaluation().window.timeZone).slice(-5);
  }

  protected time(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.evaluation().window.timeZone, true);
  }

  protected number(value: number | null | undefined): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
}
