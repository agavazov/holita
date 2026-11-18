import type { FleetDataSource } from '../../../../generated/graphql/operations';
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
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe } from '../../../ui/format/format.pipes';
import { defaultDateFormat, type FleetDateFormat } from '../../../ui/format/format';
import {
  dateTimePickerInputInstants,
  formatDateTimePickerInput,
} from '../../../ui/forms/date-time-input';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { datePickerInputPt, innerInputPt } from '../../../ui/forms/inner-input-pt';
import { validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { vehiclesText } from './i18n/messages';

export interface OdometerReading {
  readonly odometerKm: number;
  readonly recordedAt: string;
}
export interface PreviousOdometerReading extends OdometerReading {
  readonly source: FleetDataSource;
}
export type OdometerField = keyof OdometerReading;
const fields: readonly OdometerField[] = ['odometerKm', 'recordedAt'];

/** Repeated Branch wall times use an occurrence inside the permitted reading interval. */
function odometerInstant(
  date: string | null,
  bounds?: { readonly previousAt: string | null; readonly latestAllowedAt: string },
  timeZone = 'Europe/Sofia',
  dateFormat: FleetDateFormat = defaultDateFormat,
): string | null {
  const candidates = dateTimePickerInputInstants(
    date,
    timeZone,
    dateFormat,
    bounds?.latestAllowedAt,
  );
  const earliest = candidates[0];
  if (earliest === undefined) {
    return null;
  }
  if (!bounds) {
    return new Date(earliest).toISOString();
  }
  const previous =
    bounds.previousAt === null ? Number.NEGATIVE_INFINITY : Date.parse(bounds.previousAt);
  const latest = Date.parse(bounds.latestAllowedAt);
  const valid = candidates.filter((instant) => instant > previous && instant <= latest);
  // Keep the exact initial instant even when both occurrences satisfy the bounds.
  return new Date(valid.includes(latest) ? latest : (valid[0] ?? earliest)).toISOString();
}

/** MANUAL readings only; the host supplies min(now, data clock) and the last known odometer. */
@Component({
  selector: 'discocan-odometer-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    InputNumber,
    Message,
    RouteDrawer,
    FormField,
    FormatDateTimePipe,
  ],
  templateUrl: './odometer-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OdometerDrawer {
  readonly plate = input.required<string>();
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly closeLink = input<readonly string[] | null>(null);
  readonly previous = input<PreviousOdometerReading | null>(null);
  readonly inactive = input(false);
  readonly latestAllowedAt = input.required<string>();
  readonly saving = input(false);
  readonly canEdit = input(true);
  readonly saveError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<OdometerField, string>>>({});
  readonly save = output<OdometerReading>();
  readonly closed = output();
  readonly retry = output();
  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => vehiclesText(this.language()).odometer);
  private readonly displayUnit = computed(() => this.units.preferences().distanceUnit);
  protected readonly timeZone = computed(() => this.units.preferences().timeZone);
  private readonly dateFormat = computed(() => this.units.preferences().dateFormat);
  protected readonly odometerLabel = computed(() =>
    interpolate(this.text().odometerKm, {
      unit: this.units.distanceUnit(),
    }),
  );
  protected readonly timeZoneHint = computed(() =>
    interpolate(this.text().timeZone, {
      timeZone: this.timeZone(),
    }),
  );
  protected readonly unavailable = computed(() => {
    if (this.inactive()) {
      return this.text().inactive;
    }
    const previous = this.previous();
    return previous && Date.parse(previous.recordedAt) >= Date.parse(this.latestAllowedAt())
      ? this.text().noTimeInterval
      : null;
  });
  protected readonly previousLabel = computed(() =>
    interpolate(this.text().previous, {
      unit: this.units.distanceUnit(),
    }),
  );
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
      const km = this.canonicalOdometer(value, false);
      if (km < 0) {
        return { min: { min: 0 } };
      }
      return km > 9_999_999.9 ? { max: { max: this.units.distanceValue(9_999_999.9) } } : null;
    }),
    recordedAt: new FormControl<string | null>('', {
      validators: (control) => (!control.value ? { required: true } : null),
    }),
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

  protected recordedAtInput(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      // Keep typed Branch wall time and precision instead of browser Date normalization.
      this.form.controls.recordedAt.setValue(input.value, { emitModelToViewChange: false });
      this.form.controls.recordedAt.markAsDirty();
    }
  }

  constructor() {
    effect(() => {
      const latest = this.latestAllowedAt();
      const previous = this.previous();
      const timeZone = this.timeZone();
      const dateFormat = this.dateFormat();
      this.displayUnit();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          odometerKm: this.units.distanceValue(previous?.odometerKm ?? null),
          recordedAt: formatDateTimePickerInput(latest, timeZone, dateFormat),
        });
      });
    });
    effect(() => {
      const errors = this.fieldErrors();
      if (this.state() !== 'ready' || !Object.keys(errors).length) {
        return;
      }
      afterNextRender(
        () => {
          const form = this.formElement().nativeElement;
          if (this.state() === 'ready' && !this.saving() && form.isConnected) {
            focusFirstInvalid(form, fields, 'odometer-');
          }
        },
        { injector: this.injector },
      );
    });
    let locked = false;
    effect(() => {
      const saving =
        !this.canEdit() || this.saving() || !!this.unavailable() || this.state() !== 'ready';
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
              if (this.state() !== 'ready' || this.saving() || this.unavailable()) {
                return;
              }
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
      return km !== null && previous && this.canonicalOdometer(km) < previous.odometerKm
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
    if (!this.canEdit() || this.saving() || this.unavailable() || this.state() !== 'ready') {
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
      this.save.emit({ odometerKm: this.canonicalOdometer(value.odometerKm), recordedAt });
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.closeLink() !== null) {
      this.drawer().close();
      return;
    }
    if (await this.canLeave()) {
      this.closed.emit();
    }
  }

  markSaved(): void {
    this.form.markAsPristine();
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.dirty());
  }

  private readingInstant(): string | null {
    return odometerInstant(
      this.form.controls.recordedAt.value,
      {
        previousAt: this.previous()?.recordedAt ?? null,
        latestAllowedAt: this.latestAllowedAt(),
      },
      this.timeZone(),
      this.dateFormat(),
    );
  }

  private canonicalOdometer(value: number, round = true): number {
    const previous = this.previous();
    const displayedPrevious = previous ? this.units.distanceValue(previous.odometerKm) : null;
    if (
      previous &&
      displayedPrevious !== null &&
      (value === displayedPrevious || value === Math.round(displayedPrevious * 10) / 10)
    ) {
      return previous.odometerKm;
    }
    const km = value / (this.units.distanceValue(1) ?? 1);
    return round ? Math.round(km * 10) / 10 : km;
  }
}
