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
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe } from '../../../ui/format/format.pipes';
import { isoToZonedParts, zonedWallTimeToIso } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
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
  readonly source: 'DEMO' | 'MANUAL';
}
export type OdometerField = keyof OdometerReading;
const fields: readonly OdometerField[] = ['odometerKm', 'recordedAt'];

/** Floating wall time avoids normalization by the browser's own DST rules. */
export function odometerWallTime(iso: string, timeZone = 'Europe/Sofia'): string | null {
  const parts = isoToZonedParts(iso, timeZone);
  if (!parts) {
    return null;
  }
  const instant = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(instant.getUTCSeconds())}.${String(instant.getUTCMilliseconds()).padStart(3, '0')}`;
}

/** Repeated Branch wall times use an occurrence inside the permitted reading interval. */
export function odometerInstant(
  date: string | null,
  bounds?: { readonly previousAt: string | null; readonly latestAllowedAt: string },
  timeZone = 'Europe/Sofia',
): string | null {
  const match = date
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(date)
    : null;
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const second = Number(match[6] ?? 0),
    millisecond = Number((match[7] ?? '').padEnd(3, '0'));
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    calendar.getUTCFullYear() !== parts.year ||
    calendar.getUTCMonth() + 1 !== parts.month ||
    calendar.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    second > 59
  )
    return null;
  const first = Date.parse(zonedWallTimeToIso(parts, timeZone));
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    second,
    millisecond,
  );
  const occurrences = new Set<number>();
  // Nearby offsets cover repeated times including half-hour and multi-hour DST changes.
  for (const shift of [-86_400_000, 0, 86_400_000]) {
    const probe = first + shift;
    const fields = isoToZonedParts(new Date(probe).toISOString(), timeZone);
    if (!fields) continue;
    const offset =
      Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute) -
      Math.floor(probe / 60_000) * 60_000;
    const candidate = wall - offset;
    const repeated = isoToZonedParts(new Date(candidate).toISOString(), timeZone);
    if (
      repeated?.year === parts.year &&
      repeated.month === parts.month &&
      repeated.day === parts.day &&
      repeated.hour === parts.hour &&
      repeated.minute === parts.minute
    ) {
      occurrences.add(candidate);
    }
  }
  const candidates = [...occurrences].sort((left, right) => left - right);
  const earliest = candidates[0];
  // A spring gap has no actual instant; never silently normalize the intended reading.
  if (earliest === undefined) return null;
  if (!bounds) return new Date(earliest).toISOString();
  const previous =
    bounds.previousAt === null ? Number.NEGATIVE_INFINITY : Date.parse(bounds.previousAt);
  const latest = Date.parse(bounds.latestAllowedAt);
  const valid = candidates.filter((instant) => instant > previous && instant <= latest);
  // Keep the exact initial instant even when both occurrences satisfy the bounds.
  return new Date(valid.includes(latest) ? latest : (valid[0] ?? earliest)).toISOString();
}

/** MANUAL readings only; the host supplies min(now, data clock) and the last known odometer. */
@Component({
  selector: 'holita-odometer-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
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
    if (this.inactive()) return this.text().inactive;
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
    recordedAt: new FormControl('', {
      nonNullable: true,
      validators: (control) => (control.value === '' ? { required: true } : null),
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

  constructor() {
    effect(() => {
      const latest = this.latestAllowedAt();
      const previous = this.previous();
      const timeZone = this.timeZone();
      this.displayUnit();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          odometerKm: this.units.distanceValue(previous?.odometerKm ?? null),
          recordedAt: odometerWallTime(latest, timeZone) ?? '',
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
      const saving = this.saving() || !!this.unavailable() || this.state() !== 'ready';
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
              if (this.state() !== 'ready' || this.saving() || this.unavailable()) return;
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
    if (this.saving() || this.unavailable() || this.state() !== 'ready') {
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
    return this.saving() || this.drawer().confirmLeave(this.dirty());
  }

  private readingInstant(): string | null {
    return odometerInstant(
      this.form.controls.recordedAt.value,
      {
        previousAt: this.previous()?.recordedAt ?? null,
        latestAllowedAt: this.latestAllowedAt(),
      },
      this.timeZone(),
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
