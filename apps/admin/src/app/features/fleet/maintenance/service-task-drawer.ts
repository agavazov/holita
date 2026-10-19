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
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { fromDateOnly, toDateOnly } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { datePickerInputPt, innerInputPt } from '../../../ui/forms/inner-input-pt';
import {
  dateOnlyValidator,
  integerValidator,
  requireOneOf,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { lockWhileSaving } from '../../../ui/forms/saving';
import { FormatDateOnlyPipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { maintenanceText } from './i18n/messages';
import type { MaintenanceOption } from './maintenance-view';
import { serviceTypes, type ServiceType } from './service-task';

/** The editable service task fields, as the create and update mutations take them. */
export interface ServiceTaskForm {
  readonly serviceType: ServiceType;
  readonly title: string | null;
  readonly vehicleId: string;
  readonly dueOn: string | null;
  readonly dueKm: number | null;
  readonly workshop: string;
  readonly notes: string;
}

export type ServiceTaskField = keyof ServiceTaskForm;

const fieldOrder: readonly ServiceTaskField[] = [
  'serviceType',
  'title',
  'vehicleId',
  'dueOn',
  'dueKm',
  'workshop',
  'notes',
];

/**
 * Create or edit a service task in the right-hand drawer: a date, an odometer reading or both
 * (at least one), workshop and notes. Presentation only: the host saves and passes back `saving`
 * and `saveError`.
 */
@Component({
  selector: 'holita-service-task-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    InputNumber,
    InputText,
    Message,
    Select,
    Textarea,
    RouteDrawer,
    FormField,
    FormatDateOnlyPipe,
    FormatNumberPipe,
  ],
  templateUrl: './service-task-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceTaskDrawer {
  /** The task to edit; null plans a new one. */
  readonly task = input<ServiceTaskForm | null>(null);
  readonly readOnly = input(false);
  readonly vehicles = input<readonly MaintenanceOption[]>([]);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly save = output<ServiceTaskForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly catalog = computed(() => maintenanceText(this.language()));
  protected readonly text = computed(() => maintenanceText(this.language()).drawer);
  /** PrimeNG's select takes a mutable array. */
  protected readonly vehicleOptions = computed(() => [...this.vehicles()]);
  protected readonly serviceOptions = computed(() =>
    serviceTypes.map((value) => ({ value, label: this.catalog().serviceTypes[value] })),
  );
  protected readonly vehicleName = computed(
    () => this.vehicles().find((vehicle) => vehicle.id === this.task()?.vehicleId)?.name ?? '—',
  );

  protected readonly form = new FormGroup(
    {
      serviceType: new FormControl<ServiceType>('GENERAL_SERVICE', { nonNullable: true }),
      title: new FormControl('', {
        nonNullable: true,
        validators: textValidator(120),
      }),
      vehicleId: new FormControl<string | null>(null, (control) =>
        control.value ? null : { required: true },
      ),
      dueOn: new FormControl<Date | null>(null, dateOnlyValidator('2000-01-01', '2100-12-31')),
      dueKm: new FormControl<number | null>(null, integerValidator(0, 9_999_999)),
      workshop: new FormControl('', { nonNullable: true, validators: textValidator(128) }),
      notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
    },
    { validators: requireOneOf('dueOn', 'dueKm') },
  );
  /** Re-reads errors and the dirty state whenever the form reports a change. */
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const task = this.task();
    return task
      ? interpolate(this.readOnly() ? this.text().viewTitle : this.text().editTitle, {
          task: task.title ?? this.catalog().serviceTypes[task.serviceType],
        })
      : this.text().createTitle;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return !this.readOnly() && this.form.dirty;
  });
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });
  protected readonly inputPt = computed(() => ({
    dueOn: datePickerInputPt('task-dueOn', !!this.errorOf('dueOn')),
    dueKm: innerInputPt('task-dueKm', !!this.errorOf('dueKm')),
  }));

  constructor() {
    effect(() => {
      const task = this.task();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          serviceType: task?.serviceType ?? 'GENERAL_SERVICE',
          title: task?.title ?? '',
          vehicleId: task?.vehicleId ?? null,
          dueOn: fromDateOnly(task?.dueOn),
          dueKm: task?.dueKm ?? null,
          workshop: task?.workshop ?? '',
          notes: task?.notes ?? '',
        });
      });
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.drawer().keepFocusInside();
      },
    );
  }

  /** The message under a field once the user touched it or tried to save. */
  protected errorOf(name: ServiceTaskField): string | null {
    this.events();
    const control = this.form.get(name);
    if (!control?.invalid || (!control.touched && !this.submitted)) {
      return null;
    }
    return validationMessage(control.errors, this.language());
  }

  protected describedBy(name: ServiceTaskField): string {
    return `task-${name}-hint task-${name}-error`;
  }

  protected submit(): void {
    if (this.saving() || this.readOnly()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.vehicleId) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, fieldOrder, 'task-');
          }
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      serviceType: value.serviceType,
      title: value.title.trim() || null,
      vehicleId: this.task()?.vehicleId ?? value.vehicleId,
      dueOn: value.dueOn ? toDateOnly(value.dueOn) : null,
      dueKm: value.dueKm,
      workshop: value.workshop.trim(),
      notes: value.notes.trim(),
    });
  }

  /** Close button, Escape, backdrop and Cancel: unsaved changes are confirmed first. */
  protected async requestClose(): Promise<void> {
    if (this.saving()) {
      return;
    }
    if (await this.drawer().confirmLeave(this.dirty())) {
      this.closed.emit();
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving() ? false : this.drawer().confirmLeave(this.dirty());
  }
}
