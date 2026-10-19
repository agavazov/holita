import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { isoToZonedParts, zonedWallTimeToIso } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { datePickerInputPt, innerInputPt } from '../../../ui/forms/inner-input-pt';
import { validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { vehiclesText } from './i18n/messages';

export interface OdometerReading {
  readonly odometerKm: number;
  readonly recordedAt: string;
}
export interface PreviousOdometerReading extends OdometerReading {
  readonly source: 'DEMO' | 'MANUAL';
}
export type OdometerField = keyof OdometerReading;
const fields: readonly OdometerField[] = ['odometerKm', 'recordedAt'];
const timeZone = 'Europe/Sofia';

/** A DatePicker Date carries Branch wall-clock fields, independent of the browser's zone. */
export function odometerWallTime(iso: string): Date | null {
  const parts = isoToZonedParts(iso, timeZone);
  if (!parts) {
    return null;
  }
  const instant = new Date(iso);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    instant.getUTCSeconds(),
    instant.getUTCMilliseconds(),
  );
}

/** Repeated Sofia hours use an occurrence inside the permitted reading interval. */
export function odometerInstant(
  date: Date | null,
  bounds?: { readonly previousAt: string | null; readonly latestAllowedAt: string },
): string | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
  const first =
    Date.parse(zonedWallTimeToIso(parts, timeZone)) +
    date.getSeconds() * 1000 +
    date.getMilliseconds();
  if (!bounds) {
    return new Date(first).toISOString();
  }
  const later = first + 3_600_000;
  const repeated = isoToZonedParts(new Date(later).toISOString(), timeZone);
  const candidates =
    repeated?.year === parts.year &&
    repeated.month === parts.month &&
    repeated.day === parts.day &&
    repeated.hour === parts.hour &&
    repeated.minute === parts.minute
      ? [first, later]
      : [first];
  const previous =
    bounds.previousAt === null ? Number.NEGATIVE_INFINITY : Date.parse(bounds.previousAt);
  const latest = Date.parse(bounds.latestAllowedAt);
  const valid = candidates.filter((instant) => instant > previous && instant <= latest);
  // Keep the exact initial instant even when both occurrences satisfy the bounds.
  return new Date(valid.includes(latest) ? latest : (valid[0] ?? first)).toISOString();
}

/** MANUAL readings only; the host supplies min(now, data clock) and the last known odometer. */
@Component({
  selector: 'holita-odometer-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    InputNumber,
    Message,
    RouteDrawer,
    FormField,
    FormatDateTimePipe,
    FormatNumberPipe,
  ],
  templateUrl: './odometer-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OdometerDrawer {
  readonly plate = input.required<string>();
  readonly previous = input<PreviousOdometerReading | null>(null);
  readonly latestAllowedAt = input.required<string>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<OdometerField, string>>>({});
  readonly save = output<OdometerReading>();
  readonly closed = output();
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => vehiclesText(this.language()).odometer);
  protected readonly title = computed(() =>
    interpolate(this.text().title, { plate: this.plate() }),
  );
  protected readonly form = new FormGroup({
    odometerKm: new FormControl<number | null>(null, (control) => {
      const value: unknown = control.value;
      if (value === null) {
        return { required: true };
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { decimal: true };
      }
      if (value < 0) {
        return { min: { min: 0 } };
      }
      return value > 9_999_999.9 ? { max: { max: 9_999_999.9 } } : null;
    }),
    recordedAt: new FormControl<Date | null>(null, (control) =>
      control.value === null ? { required: true } : null,
    ),
  });
  private readonly events = toSignal(this.form.events);
  private submitted = false;
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly numberPt = computed(() =>
    innerInputPt('odometer-odometerKm', !!this.errorOf('odometerKm')),
  );
  protected readonly datePt = computed(() =>
    datePickerInputPt('odometer-recordedAt', !!this.errorOf('recordedAt')),
  );

  constructor() {
    effect(() => {
      const latest = this.latestAllowedAt();
      const previous = this.previous();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          odometerKm: previous?.odometerKm ?? null,
          recordedAt: odometerWallTime(latest),
        });
      });
    });
    let locked = false;
    effect(() => {
      const saving = this.saving();
      untracked(() => {
        if (saving === locked) {
          return;
        }
        locked = saving;
        if (saving) {
          this.form.disable();
        } else {
          this.form.enable();
          afterNextRender(
            () => {
              if (!focusFirstInvalid(this.formElement().nativeElement, fields, 'odometer-')) {
                this.drawer().focusTitle();
              }
            },
            { injector: this.injector },
          );
        }
      });
    });
  }

  protected errorOf(field: OdometerField, includeServer = true): string | null {
    this.events();
    const server = this.fieldErrors()[field];
    if (includeServer && server) {
      return server;
    }
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted) {
      return null;
    }
    if (control.errors) {
      return validationMessage(control.errors, this.language());
    }
    const previous = this.previous();
    if (field === 'odometerKm') {
      const km = this.form.controls.odometerKm.value;
      return km !== null && previous && Math.round(km * 10) / 10 < previous.odometerKm
        ? this.text().lowerReading
        : null;
    }
    const at = this.readingInstant();
    if (!at) {
      return this.text().invalidTime;
    }
    const year = new Date(at).getUTCFullYear();
    if (year < 2000 || year > 2100) {
      return this.text().dateRange;
    }
    if (Date.parse(at) > Date.parse(this.latestAllowedAt())) {
      return this.text().futureReading;
    }
    return previous && Date.parse(at) <= Date.parse(previous.recordedAt)
      ? this.text().earlierReading
      : null;
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    if (fields.some((field) => this.errorOf(field, false))) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fields, 'odometer-');
        },
        { injector: this.injector },
      );
      return;
    }
    const value = this.form.getRawValue();
    const recordedAt = this.readingInstant();
    if (value.odometerKm !== null && recordedAt) {
      this.save.emit({ odometerKm: Math.round(value.odometerKm * 10) / 10, recordedAt });
    }
  }

  protected async requestClose(): Promise<void> {
    if (!this.saving() && (await this.drawer().confirmLeave(this.form.dirty))) {
      this.closed.emit();
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving() ? false : this.drawer().confirmLeave(this.dirty());
  }

  private readingInstant(): string | null {
    return odometerInstant(this.form.controls.recordedAt.value, {
      previousAt: this.previous()?.recordedAt ?? null,
      latestAllowedAt: this.latestAllowedAt(),
    });
  }
}
