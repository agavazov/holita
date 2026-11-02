import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { Language } from '../../../i18n/messages';
import { FaultsPage } from './faults-page';
import { LogsPage } from './logs-page';
import { RiskPage } from './risk-page';
import { DiagnosticsReview } from './diagnostics-review';

@Component({
  selector: 'holita-diagnostics-workspace',
  imports: [FaultsPage, LogsPage, RiskPage],
  providers: [DiagnosticsReview],
  templateUrl: './diagnostics-workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DiagnosticsWorkspace {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  private readonly route = inject(ActivatedRoute);
  private readonly review = inject(DiagnosticsReview);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly source = computed(() => this.query().get('source') ?? 'HOLITA_SCENARIO');
  protected readonly section = computed(() => this.params().get('section') ?? 'faults');

  constructor() {
    effect(() => {
      this.source();
      this.review.reset();
    });
  }
}
