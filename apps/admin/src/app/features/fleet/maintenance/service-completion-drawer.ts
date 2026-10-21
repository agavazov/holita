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
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateOnlyPipe, FormatMoneyPipe } from '../../../ui/format/format.pipes';
import { fromDateOnly, toDateOnly } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { datePickerInputPt, innerInputPt } from '../../../ui/forms/inner-input-pt';
import {
  dateOnlyValidator,
  decimalValidator,
  integerValidator,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { maintenanceText } from './i18n/messages';
import { serviceEuroCents } from './service-money';
import { RouterLink } from '@angular/router';
import type { FleetRecordLink } from '../fleet-record-links';

/** Presentation context for completing one planned task, separate from live telemetry. */
export interface ServiceCompletionTask {
  readonly kind: string;
  readonly plate: string;
  readonly workshop: string;
  readonly notes: string;
}

/** Completion fields supported by completeFleetServiceTask; dates are calendar days. */
export interface ServiceCompletionForm {
  readonly completedOn: string;
  readonly completedOdometerKm: number | null;
  readonly costCents: number | null;
  readonly workshop: string;
  readonly replacedParts: string;
  readonly notes: string;
  readonly nextDueOn: string | null;
  readonly nextDueOdometerKm: number | null;
  readonly nextTitle: string | null;
}

export type ServiceCompletionField = keyof ServiceCompletionForm;
const fieldOrder: readonly ServiceCompletionField[] = [
  'completedOn',
  'completedOdometerKm',
  'costCents',
  'workshop',
  'replacedParts',
  'notes',
  'nextDueOn',
  'nextDueOdometerKm',
  'nextTitle',
];
const required: ValidatorFn = (control) => Validators.required(control);
const nextSchedule: ValidatorFn = (group) => {
  const completedOn: unknown = group.get('completedOn')?.value;
  const nextDueOn: unknown = group.get('nextDueOn')?.value;
  const completedKm: unknown = group.get('completedOdometerKm')?.value;
  const nextKm: unknown = group.get('nextDueOdometerKm')?.value;
  const date =
    completedOn instanceof Date &&
    nextDueOn instanceof Date &&
    toDateOnly(nextDueOn) <= toDateOnly(completedOn);
  const km = typeof completedKm === 'number' && typeof nextKm === 'number' && nextKm <= completedKm;
  return date || km
    ? { ...(date ? { nextDate: true } : {}), ...(km ? { nextOdometer: true } : {}) }
    : null;
};

/** Completes a task and optionally plans its next occurrence, in one host-owned save. */
@Component({
  selector: 'holita-service-completion-drawer',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    InputNumber,
    InputText,
    Message,
    Textarea,
    RouteDrawer,
    FormField,
    FormatDateOnlyPipe,
    FormatMoneyPipe,
  ],
  templateUrl: './service-completion-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCompletionDrawer {
  readonly vehicleLink = input<FleetRecordLink | null>(null);
  readonly task = input<ServiceCompletionTask | null>(null);
  readonly completed = input<ServiceCompletionForm | null>(null);
  /** The service business date, independent of the telemetry data clock. */
  readonly businessDate = input<string | null>(null);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  readonly allowNext = input(true);
  readonly retry = output();
  readonly fieldErrors = input<Partial<Record<ServiceCompletionField, string>>>({});
  readonly save = output<ServiceCompletionForm>();
  readonly closed = output();

  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => maintenanceText(this.language()).completion);
  protected readonly vehicleLabel = computed(() => maintenanceText(this.language()).drawer.vehicle);
  protected readonly completedOdometerLabel = computed(() =>
    interpolate(this.text().completedOdometerDisplay, {
      unit: this.units.distanceUnit(),
    }),
  );
  protected readonly title = computed(() =>
    this.task()
      ? interpolate(this.completed() ? this.text().recordTitle : this.text().title, {
          task: this.task()?.kind ?? '',
        })
      : this.text().loadingTitle,
  );
  protected readonly form = new FormGroup(
    {
      completedOn: new FormControl<Date | null>(null, [
        required,
        dateOnlyValidator('2000-01-01', () => this.businessDate() ?? ''),
      ]),
      completedOdometerKm: new FormControl<number | null>(null, integerValidator(0, 9_999_999)),
      cost: new FormControl<number | null>(null, decimalValidator(0, 1_000_000, 0.01)),
      workshop: new FormControl('', { nonNullable: true, validators: textValidator(128) }),
      replacedParts: new FormControl('', { nonNullable: true, validators: textValidator(1000) }),
      notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
      nextDueOn: new FormControl<Date | null>(null, dateOnlyValidator('2000-01-01', '2100-12-31')),
      nextDueOdometerKm: new FormControl<number | null>(null, integerValidator(0, 9_999_999)),
      nextTitle: new FormControl('', { nonNullable: true, validators: textValidator(120) }),
    },
    { validators: nextSchedule },
  );
  private readonly events = toSignal(this.form.events);
  private submitted = false;
  protected readonly dirty = computed(() => {
    this.events();
    return !this.completed() && this.form.dirty;
  });
  protected readonly hasNext = computed(() => {
    this.events();
    if (!this.allowNext()) {
      return false;
    }
    const value = this.form.getRawValue();
    return value.nextDueOn !== null || value.nextDueOdometerKm !== null;
  });

  constructor() {
    effect(() => {
      const task = this.task();
      const today = this.businessDate();
      if (!task || !today) {
        return;
      }
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          completedOn: fromDateOnly(today),
          completedOdometerKm: null,
          cost: null,
          workshop: task.workshop,
          replacedParts: '',
          notes: task.notes,
          nextDueOn: null,
          nextDueOdometerKm: null,
          nextTitle: '',
        });
      });
    });
    effect(() => {
      if (!this.allowNext()) {
        untracked(() => {
          this.form.controls.nextDueOn.reset(null);
          this.form.controls.nextDueOdometerKm.reset(null);
          this.form.controls.nextTitle.reset('');
        });
      }
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
              this.focusErrors();
            },
            { injector: this.injector },
          );
        }
      });
    });
    effect(() => {
      const errors = this.fieldErrors();
      if (this.state() !== 'ready' || !Object.keys(errors).length) {
        return;
      }
      untracked(() => {
        afterNextRender(
          () => {
            this.focusErrors();
          },
          { injector: this.injector },
        );
      });
    });
  }

  protected errorOf(name: ServiceCompletionField): string | null {
    this.events();
    const server = this.fieldErrors()[name];
    if (server) {
      return server;
    }
    const control = name === 'costCents' ? this.form.controls.cost : this.form.controls[name];
    if (!control.touched && !this.submitted) {
      return null;
    }
    const validation = validationMessage(control.errors, this.language());
    if (validation) {
      return validation;
    }
    if (name === 'nextDueOn' && this.form.hasError('nextDate')) {
      return this.text().nextDateError;
    }
    if (name === 'nextDueOdometerKm' && this.form.hasError('nextOdometer')) {
      return this.text().nextOdometerError;
    }
    return null;
  }

  protected inputPt(name: ServiceCompletionField) {
    const pt = name === 'completedOn' || name === 'nextDueOn' ? datePickerInputPt : innerInputPt;
    return pt(`completion-${name}`, !!this.errorOf(name));
  }

  protected describedBy(name: ServiceCompletionField): string {
    return `completion-${name}-hint completion-${name}-error`;
  }

  protected submit(): void {
    if (this.saving() || this.completed() || this.state() !== 'ready' || !this.task()) {
      return;
    }
    if (!this.hasNext()) {
      this.form.controls.nextTitle.reset('');
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const costCents = value.cost === null ? null : serviceEuroCents(String(value.cost));
    if (value.cost !== null && costCents === null) {
      this.form.controls.cost.setErrors({ step: { step: 0.01 } });
    }
    if (this.form.invalid || !value.completedOn) {
      afterNextRender(
        () => {
          this.focusErrors();
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      completedOn: toDateOnly(value.completedOn),
      completedOdometerKm: value.completedOdometerKm,
      costCents,
      workshop: value.workshop.trim(),
      replacedParts: value.replacedParts.trim(),
      notes: value.notes.trim(),
      nextDueOn: value.nextDueOn ? toDateOnly(value.nextDueOn) : null,
      nextDueOdometerKm: value.nextDueOdometerKm,
      nextTitle: this.hasNext() ? value.nextTitle.trim() || null : null,
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) {
      return;
    }
    if (await this.drawer().confirmLeave(this.dirty())) {
      this.closed.emit();
    }
  }

  private focusErrors(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fieldOrder, 'completion-')) {
      this.drawer().focusTitle();
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving() ? false : this.drawer().confirmLeave(this.dirty());
  }
  protected close(): void {
    this.drawer().close();
  }
  markSaved(): void {
    this.form.markAsPristine();
  }
}
