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
  dateFormatLabels,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  formatDateTimeInput,
  formatNumber,
  injectDisplayFormat,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  parseDateTimeInput,
  patternValidator,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type { DiscountType } from '../generated/discounts-operations';
import { DiscountsApi } from './discounts-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const decimal = /^\d{1,30}(?:[.,]\d{1,2})?$/;
const fields = [
  'code',
  'type',
  'value',
  'enabled',
  'startsAt',
  'endsAt',
  'minSubtotal',
  'usageLimit',
] as const;
type Field = (typeof fields)[number];

function canonicalDecimal(value: string): string {
  return value.trim().replace(',', '.');
}

@Component({
  selector: 'holita-discount-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
  ],
  templateUrl: './discount-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountEditor {
  private readonly api = inject(DiscountsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerHost = injectDrawerHost();
  private readonly language = inject(OperatorLanguage).value;
  private readonly format = injectDisplayFormat();
  private readonly routeData = drawerRouteData(this.route);
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() =>
    this.routeParams().get(this.routeData.recordParam ?? 'recordId'),
  );
  private readonly params = computed(() => {
    const scope = this.api.scope();
    const id = this.id();
    return this.api.canWrite() && scope && (!this.editing || (id && uuid.test(id)))
      ? { scope, id }
      : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: async ({ params: { scope, id } }) => {
      if (id) {
        const discount = await this.api.find(scope, id);
        return discount ? { discount, currency: discount.currency } : null;
      }
      const { currency } = await this.api.list(scope, { offset: 0, limit: 1 });
      return { discount: null, currency };
    },
  });
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.canWrite() || this.record.error()) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    return this.record.hasValue() && this.record.value() ? 'ready' : 'not-found';
  });
  protected readonly discount = computed(() =>
    this.record.hasValue() ? (this.record.value()?.discount ?? null) : null,
  );
  protected readonly currency = computed(() =>
    this.record.hasValue() ? (this.record.value()?.currency ?? '') : '',
  );
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<Field, string | undefined>>>({});
  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(64, { required: true }), patternValidator(/^[A-Za-z0-9_-]+$/)],
    }),
    type: new FormControl<DiscountType>('PERCENTAGE', { nonNullable: true }),
    value: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(33, { required: true }), patternValidator(decimal)],
    }),
    enabled: new FormControl(false, { nonNullable: true }),
    startsAt: new FormControl('', { nonNullable: true }),
    endsAt: new FormControl('', { nonNullable: true }),
    minSubtotal: new FormControl('', {
      nonNullable: true,
      validators: [patternValidator(decimal)],
    }),
    usageLimit: new FormControl('', {
      nonNullable: true,
      validators: [integerValidator(1, 2_147_483_647), patternValidator(/^\d+$/)],
    }),
  });
  private readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly valueUnit = computed(() =>
    this.type() === 'PERCENTAGE' ? '%' : this.currency(),
  );
  protected readonly typeOptions = computed(() => [
    { value: 'PERCENTAGE', label: this.text().discountPercentage },
    { value: 'FIXED', label: this.text().discountFixed },
  ]);
  protected readonly statusOptions = computed(() => [
    { value: true, label: this.text().discountEnabled },
    { value: false, label: this.text().discountDisabled },
  ]);
  protected readonly dateHint = computed(() => {
    const { timeZone, dateFormat } = this.format.preferences();
    return `${dateFormatLabels[dateFormat]} HH:mm · ${timeZone}`;
  });
  protected readonly uses = computed(() =>
    formatNumber(this.discount()?.redeemedCount, this.language()),
  );

  constructor() {
    effect(() => {
      this.params();
      const discount = this.discount();
      const { timeZone, dateFormat } = this.format.preferences();
      this.form.reset({
        code: discount?.code ?? '',
        type: discount?.type ?? 'PERCENTAGE',
        value: discount?.value ?? '',
        enabled: discount?.enabled ?? false,
        startsAt: formatDateTimeInput(discount?.startsAt, timeZone, dateFormat).replace(
          /(?::00)?\.000$/,
          '',
        ),
        endsAt: formatDateTimeInput(discount?.endsAt, timeZone, dateFormat).replace(
          /(?::00)?\.000$/,
          '',
        ),
        minSubtotal: discount?.minSubtotal ?? '',
        usageLimit: discount?.usageLimit?.toString() ?? '',
      });
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

  protected fieldError(name: Field): string | null {
    const control = this.form.controls[name];
    return (
      this.errors()[name] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(name: Field): void {
    this.errors.update((errors) => ({
      ...errors,
      [name]: undefined,
      ...(name === 'startsAt' ? { endsAt: undefined } : {}),
      ...(name === 'type' ? { value: undefined } : {}),
    }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (!params || this.saving() || this.state() !== 'ready') {
      return;
    }

    this.form.markAllAsTouched();
    this.saveError.set(false);
    const draft = this.form.getRawValue();
    const value = canonicalDecimal(draft.value);
    const { timeZone, dateFormat } = this.format.preferences();
    const original = this.discount();
    const startsAt = parseDateTimeInput(
      draft.startsAt.trim(),
      timeZone,
      dateFormat,
      original?.startsAt,
    );
    const endsAt = parseDateTimeInput(draft.endsAt.trim(), timeZone, dateFormat, original?.endsAt);
    const errors: Partial<Record<Field, string>> = {};
    if (draft.startsAt.trim() && !startsAt) {
      errors.startsAt = this.text().discountInvalidDate;
    }
    if (draft.endsAt.trim() && !endsAt) {
      errors.endsAt = this.text().discountInvalidDate;
    }
    if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
      errors.endsAt = this.text().discountInvalidWindow;
    }
    if (!this.form.controls.value.invalid && Number(value) <= 0) {
      errors.value = this.text().discountPositiveValue;
    } else if (draft.type === 'PERCENTAGE' && Number(value) > 100) {
      errors.value = this.text().discountPercentageLimit;
    }
    this.errors.set(errors);
    if (this.form.invalid || Object.keys(errors).length) {
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
      const id = await this.api.save(
        params.scope,
        {
          code: draft.code.trim().toUpperCase(),
          type: draft.type,
          value,
          enabled: draft.enabled,
          startsAt,
          endsAt,
          minSubtotal: canonicalDecimal(draft.minSubtotal) || null,
          usageLimit: draft.usageLimit.trim() ? Number(draft.usageLimit) : null,
        },
        params.id,
      );
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.drawerHost.saved({ message: this.text().discountSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      const returned = fieldErrors(error, fields, params.scope.language, (code) => {
        if (code === 'DUPLICATE_VALUE') {
          return this.text().discountDuplicateCode;
        }
        return code === 'INVALID_WINDOW' ? this.text().discountInvalidWindow : undefined;
      });
      this.errors.set(returned);
      this.saveError.set(Object.keys(returned).length === 0);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, fields, 'discount-')) {
      this.drawer().focusTitle();
    }
  }
}
