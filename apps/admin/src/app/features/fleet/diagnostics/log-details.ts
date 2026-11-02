import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, type UrlTree } from '@angular/router';
import { Tag } from 'primeng/tag';
import type { Language } from '../../../i18n/messages';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { mapCoordinates } from '../../../ui/map-preview/location-map';
import { MapPreview } from '../../../ui/map-preview/map-preview';
import { SourceContext } from '../../../ui/source-context/source-context';
import { toneSeverity, type StatusTone } from '../../../ui/tones';
import {
  logEvaluation,
  logFault,
  logPosition,
  logSignal,
  type DiagnosticLog,
  type DiagnosticScenario,
} from './log-mapping';
import bg from './log-details.bg.json';
import en from './log-details.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };
const severityTones: Record<DiagnosticLog['severity'], StatusTone> = {
  INFO: 'info',
  WARNING: 'warn',
  CRITICAL: 'danger',
};

@Component({
  selector: 'holita-log-details',
  standalone: true,
  imports: [MapPreview, RouterLink, SourceContext, Tag],
  templateUrl: './log-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-stack', '[attr.lang]': 'language()' },
})
export class LogDetails {
  readonly scenario = input.required<DiagnosticScenario>();
  readonly log = input.required<DiagnosticLog>();
  readonly language = input.required<Language>();
  readonly riskLink = input<UrlTree | null>(null);
  readonly faultLink = input<UrlTree | null>(null);
  readonly logLink = input.required<(id: string) => UrlTree>();

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly evaluation = computed(() => logEvaluation(this.scenario(), this.log()));
  protected readonly signal = computed(() => logSignal(this.scenario(), this.log()));
  protected readonly position = computed(() => logPosition(this.scenario(), this.log()));
  protected readonly fault = computed(() => logFault(this.scenario(), this.log()));
  protected readonly severity = computed(() => toneSeverity(severityTones[this.log().severity]));
  protected readonly vehicleLabel = computed(
    () =>
      this.scenario().vehicles.find((vehicle) => vehicle.id === this.log().vehicleId)?.label ??
      this.log().vehicleId,
  );
  protected readonly facts = computed(() => {
    const log = this.log();
    const text = this.text();
    return [
      { label: text.logId, value: log.id },
      { label: text.vehicle, value: this.vehicleLabel() },
      { label: text.vehicleId, value: log.vehicleId },
      { label: text.tripId, value: log.tripId ?? '—' },
      {
        label: log.kind === 'RULE_EVALUATION' ? text.processingAt : text.eventAt,
        value: this.time(log.provenance.eventAt),
      },
      {
        label: text.reportedStatus,
        value: log.reportedStatus ? text.statuses[log.reportedStatus] : '—',
      },
      { label: text.reason, value: log.reason ? text.reasons[log.reason] : '—' },
      { label: text.timeZone, value: this.scenario().period.timeZone },
    ];
  });
  protected readonly signalFacts = computed(() => {
    const signal = this.signal();
    const text = this.text();
    return signal
      ? [
          { label: text.signalId, value: signal.id },
          { label: text.signal, value: text.signals[signal.signal] },
          {
            label: text.value,
            value: signal.value == null ? text.valueUnavailable : this.number(signal.value),
          },
          { label: text.unit, value: text.units[signal.unit] },
          { label: text.availability, value: text.availabilityStates[signal.availability] },
          { label: text.sampleAt, value: this.time(signal.provenance.eventAt) },
          { label: text.positionId, value: signal.positionSampleId },
        ]
      : [];
  });
  protected readonly evaluationFacts = computed(() => {
    const evaluation = this.evaluation();
    const text = this.text();
    return evaluation
      ? [
          { label: text.evaluationId, value: evaluation.id },
          { label: text.rule, value: text.rules[evaluation.rule] },
          { label: text.ruleId, value: evaluation.ruleId },
          { label: text.version, value: this.number(evaluation.version) },
          { label: text.state, value: text.states[evaluation.state] },
          {
            label: text.windowFrom,
            value: this.time(evaluation.window.from, evaluation.window.timeZone),
          },
          {
            label: text.windowTo,
            value: this.time(evaluation.window.toExclusive, evaluation.window.timeZone),
          },
          { label: text.timeZone, value: evaluation.window.timeZone },
          { label: text.evaluatedAt, value: this.time(evaluation.evaluatedAt) },
          { label: text.availableInputs, value: this.number(evaluation.availableInputs) },
          { label: text.requiredInputs, value: this.number(evaluation.requiredInputs) },
        ]
      : [];
  });
  protected readonly contributingLogs = computed(() => {
    const evaluation = this.evaluation();
    return evaluation
      ? evaluation.contributingLogIds.map((id) => ({
          id,
          available: this.scenario().logs.some(
            (log) =>
              log.id === id &&
              log.vehicleId === evaluation.vehicleId &&
              log.tripId === evaluation.tripId &&
              log.provenance.source === evaluation.provenance.source &&
              log.provenance.scenarioId === evaluation.provenance.scenarioId,
          ),
        }))
      : [];
  });
  protected readonly coordinates = computed(() =>
    mapCoordinates(this.position()?.latitude, this.position()?.longitude),
  );
  protected readonly mapIdentity = computed(
    () => `${this.vehicleLabel()} · ${this.log().id} · ${this.position()?.id ?? '—'}`,
  );

  protected sampleReference(id: string): string {
    const evaluation = this.evaluation();
    const sample = evaluation
      ? this.scenario().signalSamples.find(
          (sample) =>
            sample.id === id &&
            sample.vehicleId === evaluation.vehicleId &&
            sample.tripId === evaluation.tripId &&
            sample.provenance.source === evaluation.provenance.source &&
            sample.provenance.scenarioId === evaluation.provenance.scenarioId,
        )
      : null;
    return `${id} · ${sample ? this.text().signals[sample.signal] : this.text().referenceUnavailable}`;
  }

  protected time(
    value: string | null | undefined,
    timeZone = this.scenario().period.timeZone,
  ): string {
    return formatDateTime(value, this.language(), timeZone, true);
  }

  private number(value: number | null | undefined): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
}
