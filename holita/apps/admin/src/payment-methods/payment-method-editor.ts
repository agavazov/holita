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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { PaymentMethodsApi } from './payment-methods-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ['label', 'enabled', 'sortOrder', 'instructions'] as const;
type Field = (typeof fields)[number];

@Component({
  selector: 'holita-payment-method-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Textarea,
  ],
  templateUrl: './payment-method-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodEditor {
  private readonly api = inject(PaymentMethodsApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() => this.params().get(this.routeData.recordParam ?? 'recordId'));
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.label ?? null) : null,
  );
  protected readonly statusOptions = computed(() => [
    { value: true, label: this.text().methodEnabled },
    { value: false, label: this.text().methodDisabled },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly form = new FormGroup({
    label: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    sortOrder: new FormControl<number | null>(0, {
      validators: [integerValidator(0, 2_147_483_647, { required: true })],
    }),
    enabled: new FormControl(false, { nonNullable: true }),
    instructions: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(Infinity, { required: true })],
    }),
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const method = this.record.hasValue() ? this.record.value() : null;
      this.form.reset(
        {
          label: method?.label ?? '',
          enabled: method?.enabled ?? false,
          sortOrder: method?.sortOrder ?? 0,
          instructions: method?.instructions ?? '',
        },
        { emitEvent: false },
      );
      this.errors.set({});
      this.saveError.set(false);
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected error(field: Field): string | null {
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected clearError(field: Field): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(false);
    const { sortOrder, ...draft } = this.form.getRawValue();
    if (this.form.invalid || sortOrder === null) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    this.saving.set(true);
    try {
      const id = await this.api.save(scope, { ...draft, sortOrder }, this.id());
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().paymentMethodSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const errors = fieldErrors(error, fields, scope.language);
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (
      !form ||
      !focusFirstInvalid(
        form,
        ['label', 'enabled', 'sort-order', 'instructions'],
        'payment-method-',
      )
    ) {
      this.drawer().focusTitle();
    }
  }
}
