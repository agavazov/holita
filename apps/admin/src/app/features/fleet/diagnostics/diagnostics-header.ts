import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, type UrlTree } from '@angular/router';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { FormField } from '../../../ui/form-field/form-field';
import { formatDateTime } from '../../../ui/format/format';
import { PageHeader } from '../../../ui/page-header/page-header';
import type { DiagnosticScenario } from './fault-mapping';
import type { DiagnosticSection } from './diagnostic-navigation';
import { diagnosticJourney, journeyBackNavigation } from './diagnostic-journey';
import bg from './bg.json';
import en from './en.json';
const catalogs: Record<Language, typeof en> = { bg, en };
@Component({
  selector: 'holita-diagnostics-header',
  imports: [FormsModule, RouterLink, Select, Tag, FormField, PageHeader],
  templateUrl: './diagnostics-header.html',
  styleUrl: './diagnostics-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-stack' },
})
export class DiagnosticsHeader {
  readonly language = input.required<Language>();
  readonly section = input.required<DiagnosticSection>();
  readonly source = input.required<FleetEvidenceSource>();
  readonly scenario = input<DiagnosticScenario | null>(null);
  readonly links = input.required<Record<DiagnosticSection, UrlTree>>();
  readonly sourceChange = output<FleetEvidenceSource>();
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly journey = computed(() => diagnosticJourney(this.params()));
  protected readonly back = computed(() => {
    const journey = this.journey();
    return journey
      ? journeyBackNavigation(
          journey,
          this.route.snapshot.paramMap.get('branchId') ?? '',
          this.language(),
        )
      : { commands: ['/', this.language(), 'karma-client', 'cars'], query: null, fragment: null };
  });
  protected readonly activeJourney = computed(() => {
    const journey = this.journey();
    return journey?.source === this.source() ? journey : null;
  });
  protected readonly realDestination = computed(() => {
    const journey = this.journey();
    return journey?.source === 'KARMA_API'
      ? ['/', this.language(), 'karma-client', 'cars', journey.vehicleId, 'diagnostics']
      : ['/', this.language(), 'karma-client', 'cars'];
  });
  protected readonly sourceOptions = computed(() => [
    { value: 'HOLITA_SCENARIO', label: this.text().example },
    { value: 'KARMA_API', label: this.text().real },
  ]);
  protected readonly sections = computed(() => [
    { id: 'faults' as const, label: this.text().section },
    { id: 'logs' as const, label: this.text().logs },
    { id: 'risk' as const, label: this.text().risk },
  ]);
  protected readonly presentation = computed(() => {
    const text = this.text();
    switch (this.section()) {
      case 'faults':
        return { title: text.section, description: text.description, hint: text.periodHint };
      case 'logs':
        return { title: text.logs, description: text.logsDescription, hint: text.logsPeriodHint };
      case 'risk':
        return { title: text.risk, description: text.riskDescription, hint: text.riskPeriodHint };
    }
  });
  protected changeSource(value: unknown): void {
    if (value === 'HOLITA_SCENARIO' || value === 'KARMA_API') {
      this.sourceChange.emit(value);
    }
  }
  protected time(value: string): string {
    return formatDateTime(
      value,
      this.language(),
      this.scenario()?.period.timeZone ?? 'Europe/Sofia',
    );
  }
}
