import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import type { Language } from '../../../i18n/messages';
import { attentionText, DiagnosticsReview, type DiagnosticReviewKind } from './diagnostics-review';

@Component({
  selector: 'holita-diagnostic-review-controls',
  imports: [ButtonDirective, Tag],
  templateUrl: './diagnostic-review-controls.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-stack' },
})
export class DiagnosticReviewControls {
  readonly kind = input.required<DiagnosticReviewKind>();
  readonly recordId = input.required<string>();
  readonly language = input.required<Language>();
  protected readonly review = inject(DiagnosticsReview);
  protected readonly text = computed(() => attentionText[this.language()]);
  protected readonly status = computed(() => this.review.status(this.kind(), this.recordId()));
}
