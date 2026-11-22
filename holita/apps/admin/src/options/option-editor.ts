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
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  errorCode,
  fieldErrors,
  focusFirstInvalid,
  formatNumber,
  injectDrawerHost,
  interpolate,
  lockWhileSaving,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { ArrowDownIcon } from 'primeng/icons/arrowdown';
import { ArrowUpIcon } from 'primeng/icons/arrowup';
import { TrashIcon } from 'primeng/icons/trash';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { OptionsApi } from './options-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ValueForm = FormGroup<{ id: FormControl<string | null>; label: FormControl<string> }>;

function valueForm(id: string | null, label: string): ValueForm {
  return new FormGroup({
    id: new FormControl(id),
    label: new FormControl(label, {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
  });
}

@Component({
  selector: 'holita-option-editor',
  imports: [
    ArrowDownIcon,
    ArrowUpIcon,
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    TrashIcon,
  ],
  templateUrl: './option-editor.html',
  styleUrl: './option-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionEditor {
  private readonly api = inject(OptionsApi);
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
  protected readonly record = resource({
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
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly statusOptions = computed(() => [
    { value: true, label: this.text().optionActive },
    { value: false, label: this.text().optionInactive },
  ]);
  protected readonly visibilityOptions = computed(() => [
    { value: true, label: this.text().optionFilterShown },
    { value: false, label: this.text().optionFilterHidden },
  ]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly values = new FormArray<ValueForm>([]);
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    active: new FormControl(true, { nonNullable: true }),
    showInFilters: new FormControl(false, { nonNullable: true }),
    values: this.values,
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const option = this.record.hasValue() ? this.record.value() : null;
      const values = option?.values ?? [];
      this.values.clear({ emitEvent: false });
      this.values.push(
        values.map(({ id, label }) => valueForm(id, label)),
        { emitEvent: false },
      );
      this.form.reset(
        {
          name: option?.name ?? '',
          active: option?.active ?? true,
          showInFilters: option?.showInFilters ?? false,
          values,
        },
        { emitEvent: false },
      );
      this.errors.set({});
      this.saveError.set(null);
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

  protected nameError(): string | null {
    return this.controlError(this.form.controls.name, 'name');
  }

  protected valueError(index: number): string | null {
    return (
      this.errors()[`values.${String(index)}.id`] ??
      this.controlError(this.values.at(index).controls.label, `values.${String(index)}.label`)
    );
  }

  protected clearError(path: string): void {
    this.errors.update((errors) => ({ ...errors, [path]: undefined }));
  }

  protected indexedLabel(template: string, index: number): string {
    return interpolate(template, { number: formatNumber(index + 1, this.language.value()) });
  }

  protected addValue(): void {
    this.values.push(valueForm(null, ''));
    this.valuesChanged(this.values.length - 1);
  }

  protected moveValue(index: number, direction: -1 | 1): void {
    const next = index + direction;
    if (next < 0 || next >= this.values.length) {
      return;
    }
    const value = this.values.at(index);
    this.values.removeAt(index, { emitEvent: false });
    this.values.insert(next, value);
    this.valuesChanged(next);
  }

  protected removeValue(index: number): void {
    this.values.removeAt(index);
    this.valuesChanged(Math.min(index, this.values.length - 1));
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.saveError.set(null);
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const { values, ...draft } = this.form.getRawValue();
    this.saving.set(true);
    try {
      const id = await this.api.save(
        scope,
        { ...draft, values: values.map(({ id, label }) => (id ? { id, label } : { label })) },
        this.id(),
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().optionSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const fields = [
        'name',
        'values',
        ...values.flatMap((_, index) => [
          `values.${String(index)}.id`,
          `values.${String(index)}.label`,
        ]),
      ];
      const errors = fieldErrors(error, fields, scope.language, (_code, path) =>
        path.endsWith('.id') ? this.text().optionValueUnavailable : undefined,
      );
      this.errors.set(errors);
      this.saveError.set(
        Object.keys(errors).length
          ? null
          : errorCode(error) === 'CONFLICT'
            ? this.text().optionValueInUse
            : this.text().optionSaveFailed,
      );
    } finally {
      this.saving.set(false);
    }
  }

  private controlError(control: FormControl<string>, path: string): string | null {
    return (
      this.errors()[path] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  private valuesChanged(next: number): void {
    this.values.markAsDirty();
    this.errors.update(({ name }) => ({ name }));
    afterNextRender(
      () => {
        const target = next < 0 ? 'option-add-value' : `option-value-${String(next)}`;
        this.formElement()?.nativeElement.querySelector<HTMLElement>(`#${target}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    const order = ['name', ...this.values.controls.map((_, index) => `value-${String(index)}`)];
    if (!form || !focusFirstInvalid(form, order, 'option-')) {
      this.drawer().focusTitle();
    }
  }
}
