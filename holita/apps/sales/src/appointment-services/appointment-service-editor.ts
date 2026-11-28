import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  UI_LANGUAGE,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  selectMultiplePt,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { AppointmentServiceColor } from '../generated/appointment-services-operations';
import { appointmentServiceStrings } from './appointment-service-strings';
import { AppointmentServicesApi } from './appointment-services-api';

const fields = [
  'name',
  'description',
  'durationMinutes',
  'bufferMinutes',
  'weekdays',
  'startTime',
  'endTime',
] as const;
type Field = (typeof fields)[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const intMax = 2_147_483_647;

@Component({
  selector: 'holita-appointment-service-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Textarea,
    ToggleSwitch,
  ],
  templateUrl: './appointment-service-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentServiceEditor {
  private readonly api = inject(AppointmentServicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly id = computed(() => this.params().get('recordId'));
  protected readonly editing = computed(() => this.id() !== null);
  protected readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.find(params.scope, params.id, abortSignal),
  });
  private readonly existing = computed(() => (this.record.hasValue() ? this.record.value() : null));
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.editing()) {
      return 'ready';
    }
    if (!uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return this.existing() ? 'ready' : 'not-found';
  });
  protected readonly subtitle = computed(() => this.existing()?.name ?? null);
  protected readonly closeLink = computed(() => ['/', this.language(), 'appointment-services']);
  protected readonly text = computed(() => appointmentServiceStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly saveLabel = computed(() => operatorStrings[this.language()].save);
  protected readonly colors = computed(() =>
    Object.entries(this.text().colors).map(([value, label]) => ({
      value,
      slot: value.toLowerCase(),
      label,
    })),
  );
  protected readonly days = computed(() =>
    this.text().days.map((label, index) => ({ label, value: index + 1 })),
  );
  protected readonly slotFields = ['durationMinutes', 'bufferMinutes'] as const;
  protected readonly timeFields = ['startTime', 'endTime'] as const;
  protected readonly selectMultiplePt = selectMultiplePt;
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string>>>({});
  private readonly builder = inject(NonNullableFormBuilder);
  protected readonly form = this.builder.group({
    name: ['', textValidator(255, { required: true })],
    description: [''],
    color: this.builder.control<AppointmentServiceColor>('C1'),
    active: [true],
    durationMinutes: new FormControl<number | null>(45, {
      nonNullable: true,
      validators: integerValidator(1, intMax, { required: true }),
    }),
    bufferMinutes: new FormControl<number | null>(15, {
      nonNullable: true,
      validators: integerValidator(0, intMax, { required: true }),
    }),
    weekdays: this.builder.control<number[]>([1, 2, 3, 4, 5], (control) =>
      Validators.required(control),
    ),
    startTime: this.builder.control('09:00', (control) => Validators.required(control)),
    endTime: this.builder.control('17:00', (control) => Validators.required(control)),
  });

  constructor() {
    effect(() => {
      const service = this.existing();
      if (service) {
        this.form.reset({ ...service, description: service.description ?? '' });
      } else {
        this.form.reset();
      }
      this.errors.set({});
      this.saveError.set(false);
    });
    lockWhileSaving(this.form, this.saving, () => {
      if (this.saveError() || Object.keys(this.errors()).length) {
        this.focusError();
      }
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(field: Field): void {
    this.errors.update(({ [field]: _error, ...remaining }) => remaining);
  }

  protected clearWindowError(field: Field): void {
    this.clearError(field);
    this.clearError('endTime');
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    const { active, durationMinutes, bufferMinutes, ...input } = this.form.getRawValue();
    if (this.form.invalid || durationMinutes === null || bufferMinutes === null) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }

    this.drawer().focusTitle();
    this.saving.set(true);
    try {
      const id = await this.api.save(
        scope,
        {
          ...input,
          durationMinutes,
          bufferMinutes,
          ...(active === this.existing()?.active ? {} : { active }),
        },
        this.id(),
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().saved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language, (code) =>
        code === 'WINDOW_TOO_SHORT' ? this.text().invalidWindow : undefined,
      );
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'service-')) {
      this.drawer().focusTitle();
    }
  }
}
