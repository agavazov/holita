import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

/** One panel of KPI tiles separated by thin dividers; loading and errors apply to the whole strip. */
@Component({
  selector: 'holita-kpi-strip',
  imports: [ButtonDirective, Message],
  template: `
    @if (error(); as error) {
      <div class="kpi-strip__error">
        <p-message severity="error" variant="simple" size="small">{{ error }}</p-message>
        <button
          pButton
          type="button"
          size="small"
          severity="secondary"
          [outlined]="true"
          (click)="retry.emit()"
        >
          {{ text().retry }}
        </button>
      </div>
    }
    <div class="kpi-strip__tiles">
      <ng-content />
    </div>
  `,
  styleUrl: './kpi-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class KpiStrip {
  readonly label = input.required<string>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly retry = output();
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()]);
}
