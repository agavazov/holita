import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { karmaDateControl, karmaDatePickerPt } from '../karma-date-time';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

/** The API clock stays text: a local Date must never normalize UTC or unspecified wall-clock hours. */
@Component({
  selector: 'holita-karma-date-time',
  imports: [FormsModule, DatePicker, InputText],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => KarmaDateTime), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-datepicker
      [inputId]="inputId()"
      [ngModel]="date()"
      (ngModelChange)="changeDate($event)"
      [ngModelOptions]="{ standalone: true }"
      dateFormat="yy-mm-dd"
      dataType="string"
      [keepInvalid]="true"
      [showIcon]="true"
      [fluid]="true"
      [disabled]="disabled()"
      [invalid]="dateInvalid()"
      appendTo="body"
      [pt]="datePt()"
      (onBlur)="touch()"
    />
    <input
      pInputText
      [id]="inputId() + '-time'"
      [attr.aria-label]="timeLabel()"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      [value]="time()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      placeholder="HH:mm:ss"
      maxlength="8"
      (input)="changeTime($event)"
      (blur)="touch()"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--p-app-space-2);
      min-inline-size: 0;
    }
    p-datepicker {
      flex: 1 1 11rem;
      min-inline-size: 0;
    }
    input {
      flex: 0 0 6rem;
      inline-size: 6rem;
      min-inline-size: 0;
    }
  `,
})
export class KarmaDateTime implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly invalidPart = input<'both' | 'time'>('both');
  readonly describedBy = input<string | null>(null);
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly disabled = signal(false);
  protected readonly dateInvalid = computed(() => this.invalid() && this.invalidPart() !== 'time');
  protected readonly datePt = computed(() => ({
    ...karmaDatePickerPt,
    pcInputText: {
      root: {
        'aria-invalid': this.dateInvalid() ? 'true' : null,
        'aria-describedby': this.describedBy(),
      },
    },
  }));
  private readonly language = inject(UI_LANGUAGE);
  protected readonly timeLabel = computed(() =>
    interpolate((this.language() === 'bg' ? bg : en).time, { label: this.label() }),
  );
  private change: (value: string) => void = () => undefined;
  protected touch: () => void = () => undefined;

  writeValue(value: unknown): void {
    const raw = karmaDateControl(typeof value === 'string' ? value : '');
    const separator = raw.indexOf(' ');
    this.date.set(separator === -1 ? raw : raw.slice(0, separator));
    this.time.set(separator === -1 ? '' : raw.slice(separator + 1));
  }

  registerOnChange(change: (value: string) => void): void {
    this.change = change;
  }

  registerOnTouched(touch: () => void): void {
    this.touch = touch;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected changeDate(value: unknown): void {
    const date = typeof value === 'string' ? value : '';
    this.date.set(date);
    if (!date) {
      this.time.set('');
      this.change('');
      return;
    }
    if (!this.time()) {
      this.time.set('00:00:00');
    }
    this.publish();
  }

  protected changeTime(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.time.set(event.target.value);
      this.publish();
    }
  }

  private publish(): void {
    this.change(this.date() || this.time() ? `${this.date()}T${this.time()}` : '');
  }
}
