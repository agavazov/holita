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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { fromDateOnly, toDateOnly } from '../../../ui/format/zoned-time';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { innerInputPt } from '../../../ui/forms/inner-input-pt';
import {
  dateOnlyValidator,
  decimalValidator,
  integerValidator,
  requireOneOf,
  textValidator,
  validationMessage,
} from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { maintenanceText } from './i18n/messages';
import type { MaintenanceOption } from './maintenance-view';

/** The editable service task fields, as the create and update mutations take them. */
export interface ServiceTaskForm {
  readonly kind: string;
  readonly vehicleId: string;
  readonly dueOn: string | null;
  readonly dueKm: number | null;
  readonly costCents: number | null;
  readonly notes: string;
  readonly done: boolean;
}

export type ServiceTaskField = keyof ServiceTaskForm;

const fieldOrder: readonly ServiceTaskField[] = [
  'kind',
  'vehicleId',
  'dueOn',
  'dueKm',
  'costCents',
  'notes',
];

/**
 * Create or edit a service task in the right-hand drawer: a date, an odometer reading or both
 * (at least one), cost and notes. Presentation only: the host saves and passes back `saving`
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
    ToggleSwitch,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './service-task-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceTaskDrawer {
  /** The task to edit; null plans a new one. */
  readonly task = input<ServiceTaskForm | null>(null);
  readonly vehicles = input<readonly MaintenanceOption[]>([]);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly save = output<ServiceTaskForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => maintenanceText(this.language()).drawer);
  /** PrimeNG's select takes a mutable array. */
  protected readonly vehicleOptions = computed(() => [...this.vehicles()]);

  protected readonly form = new FormGroup(
    {
      kind: new FormControl('', {
        nonNullable: true,
        validators: textValidator(80, { required: true }),
      }),
      vehicleId: new FormControl<string | null>(null, (control) =>
        control.value ? null : { required: true },
      ),
      dueOn: new FormControl<Date | null>(null, dateOnlyValidator(null, null)),
      dueKm: new FormControl<number | null>(null, integerValidator(0, 3_000_000)),
      cost: new FormControl<number | null>(null, decimalValidator(0, 1_000_000, 0.01)),
      notes: new FormControl('', { nonNullable: true, validators: textValidator(2000) }),
      done: new FormControl(false, { nonNullable: true }),
    },
    { validators: requireOneOf('dueOn', 'dueKm') },
  );
  /** Re-reads errors and the dirty state whenever the form reports a change. */
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const task = this.task();
    return task ? interpolate(this.text().editTitle, { task: task.kind }) : this.text().createTitle;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly notesLength = computed(() => {
    this.events();
    return Array.from(this.form.controls.notes.value).length;
  });
  protected readonly inputPt = computed(() => ({
    dueOn: innerInputPt('task-dueOn', !!this.errorOf('dueOn')),
    dueKm: innerInputPt('task-dueKm', !!this.errorOf('dueKm')),
    costCents: innerInputPt('task-costCents', !!this.errorOf('costCents')),
  }));

  constructor() {
    effect(() => {
      const task = this.task();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          kind: task?.kind ?? '',
          vehicleId: task?.vehicleId ?? null,
          dueOn: fromDateOnly(task?.dueOn),
          dueKm: task?.dueKm ?? null,
          cost:
            task?.costCents === null || task?.costCents === undefined ? null : task.costCents / 100,
          notes: task?.notes ?? '',
          done: task?.done ?? false,
        });
      });
    });
  }

  /** The message under a field once the user touched it or tried to save. */
  protected errorOf(name: ServiceTaskField): string | null {
    this.events();
    const control = name === 'costCents' ? this.form.controls.cost : this.form.get(name);
    if (!control?.invalid || (!control.touched && !this.submitted)) return null;
    return validationMessage(control.errors, this.language());
  }

  protected describedBy(name: ServiceTaskField): string {
    return `task-${name}-hint task-${name}-error`;
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.vehicleId) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'task-');
        },
        { injector: this.injector },
      );
      return;
    }
    this.save.emit({
      kind: value.kind.trim(),
      vehicleId: value.vehicleId,
      dueOn: value.dueOn ? toDateOnly(value.dueOn) : null,
      dueKm: value.dueKm,
      costCents: value.cost === null ? null : Math.round(value.cost * 100),
      notes: value.notes.trim(),
      done: value.done,
    });
  }

  /** Close button, Escape, backdrop and Cancel: unsaved changes are confirmed first. */
  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (await this.drawer().confirmLeave(this.form.dirty)) this.closed.emit();
  }
}
