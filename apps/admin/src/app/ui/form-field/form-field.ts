import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Message } from 'primeng/message';
import { formatNumber } from '../format/format';
import { interpolate, uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export interface FieldCounter {
  /** Length in code points. */
  readonly length: number;
  readonly max: number;
}

/**
 * Label, hint, error and counter around one projected control. The control sets its own `id`
 * (`controlId`), `[attr.aria-describedby]="'<id>-hint <id>-error'"`, `[attr.aria-invalid]` and
 * `[invalid]`; a group control without one input (select button) uses
 * `ariaLabelledBy="<id>-label"`.
 */
@Component({
  selector: 'holita-form-field',
  imports: [Message],
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false);
  readonly counter = input<FieldCounter | null>(null);

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly counterText = computed(() => {
    const counter = this.counter();
    if (!counter) return null;
    return interpolate(this.text().field.counter, {
      length: formatNumber(counter.length, this.language()),
      max: formatNumber(counter.max, this.language()),
    });
  });
  protected readonly counterWarn = computed(() => {
    const counter = this.counter();
    return !!counter && counter.length > counter.max * 0.9;
  });
}
