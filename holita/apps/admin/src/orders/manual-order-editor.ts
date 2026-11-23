import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type FormGroup,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  innerInputPt,
  lockWhileSaving,
  normalizeSearch,
  searchApplies,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { AutoComplete } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import type { OperatorOrderDetailFragment } from '../generated/orders-operations';
import { orderAmount } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

interface VariantChoice {
  id: string;
  label: string;
}

interface LineChoice {
  lineId?: string;
  variantId: string | null;
  label: string;
}

type LineForm = FormGroup<{
  choice: FormControl<LineChoice>;
  quantity: FormControl<number | null>;
}>;

const required = (control: AbstractControl) => Validators.required(control);

const contactKeys = ['name', 'email', 'phone'] as const;
const contactPaths = contactKeys.map((key) => `contact.${key}`);
const addressPaths = [
  'shippingAddress.line1',
  'shippingAddress.line2',
  'shippingAddress.city',
  'shippingAddress.postalCode',
  'shippingAddress.countryCode',
];

function operatorFieldPath(path: string): string {
  return path.replace(/\.([a-z0-9])/gu, (_, initial: string) => initial.toUpperCase());
}

@Component({
  selector: 'holita-manual-order-editor',
  imports: [
    AutoComplete,
    ButtonDirective,
    FormField,
    InputText,
    Message,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Textarea,
  ],
  templateUrl: './manual-order-editor.html',
  styles: `
    .manual-order-line > strong {
      overflow-wrap: anywhere;
    }

    .manual-order-quantity > input {
      flex: 1;
      min-inline-size: 0;
    }

    .manual-order-quantity > button {
      flex-shrink: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualOrderEditor {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage).value;
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = injectDrawerHost();
  private readonly builder = inject(NonNullableFormBuilder);
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');

  private readonly routeData = drawerRouteData(this.route);
  private readonly routeParams = toSignal((this.route.parent ?? this.route).paramMap, {
    requireSync: true,
  });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() => this.routeParams().get('recordId') ?? '');
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly canWrite = this.api.canWrite;
  private readonly params = computed(() => {
    const scope = this.api.scope();
    const id = this.editing ? this.id() : null;
    return scope && this.canWrite() && (id === null || orderIdPattern.test(id))
      ? { scope, id }
      : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: async ({ params: { scope, id } }) => {
      const order = id ? await this.api.find(scope, id) : null;
      const choices = !id || order?.canEditManualOrder ? await this.api.manualChoices(scope) : null;
      return { order, choices };
    },
  });
  private readonly loadedOrder = computed(() =>
    this.record.hasValue() ? this.record.value().order : null,
  );
  protected readonly order = linkedSignal(() => this.loadedOrder());
  protected readonly amountsLocked = computed(() => !!this.order()?.invoice);
  private readonly choices = computed(() =>
    this.record.hasValue() ? this.record.value().choices : null,
  );
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || this.record.error()) {
      return 'error';
    }
    if (this.editing && !orderIdPattern.test(this.id())) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.canWrite() && this.editing && !this.order()) {
      return 'not-found';
    }
    return 'ready';
  });
  protected readonly canEdit = computed(
    () =>
      this.canWrite() && !!this.choices() && (!this.editing || this.order()?.canEditManualOrder),
  );
  protected readonly customerOptions = computed(() => [
    { id: '', label: this.text().guestOrder, name: '', email: '', phone: '' },
    ...(this.choices()?.customers ?? []).map(({ id, name, email, phone }) => ({
      id,
      name,
      email,
      phone: phone ?? '',
      label: `${name} · ${email}`,
    })),
  ]);
  protected readonly paymentOptions = computed(() => {
    const options = this.choices()?.manualOrderMethods.paymentMethods ?? [];
    const order = this.order();
    return order?.paymentMethodId
      ? [
          { id: order.paymentMethodId, label: order.paymentMethodLabel },
          ...options.filter(({ id }) => id !== order.paymentMethodId),
        ]
      : options;
  });
  protected readonly shippingOptions = computed(() => {
    const options = this.choices()?.manualOrderMethods.shippingMethods ?? [];
    const order = this.order();
    return order?.shippingMethodId
      ? [
          {
            id: order.shippingMethodId,
            label: order.shippingMethodLabel,
            fixedFee: order.shippingFee,
          },
          ...options.filter(({ id }) => id !== order.shippingMethodId),
        ]
      : options;
  });

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly errors = signal<Partial<Record<string, string>>>({});
  private readonly autofilledContact = new Set<(typeof contactKeys)[number]>();
  protected readonly form = this.builder.group({
    customerId: '',
    contact: this.builder.group({
      name: ['', required],
      email: ['', [required, (control: AbstractControl) => Validators.email(control)]],
      phone: ['', required],
    }),
    shippingAddress: this.builder.group({
      countryCode: ['BG', [required, Validators.pattern(/^[a-z]{2}$/i)]],
      city: ['', required],
      postalCode: ['', required],
      line1: ['', required],
      line2: '',
    }),
    merchantNote: '',
    paymentMethodId: ['', required],
    shippingMethodId: ['', required],
    lines: new FormArray<LineForm>([], required),
    variantPicker: new FormControl<VariantChoice | string | null>(null),
  });
  protected readonly lines = this.form.controls.lines;
  private readonly selectedShipping = toSignal(this.form.controls.shippingMethodId.valueChanges, {
    initialValue: this.form.controls.shippingMethodId.value,
  });
  protected readonly shippingFee = computed(() => {
    const fee = this.shippingOptions().find(({ id }) => id === this.selectedShipping())?.fixedFee;
    const currency = this.order()?.currency ?? this.choices()?.manualOrderMethods.currency;
    return fee && currency ? orderAmount(fee, currency, this.language()) : null;
  });

  private readonly search = signal<string | null>(null);
  protected readonly searchInvalid = computed(() => {
    const search = this.search() ?? '';
    return !searchApplies(search);
  });
  protected readonly products = resource({
    params: () => {
      const scope = this.api.scope();
      const search = this.search();
      return scope &&
        this.canEdit() &&
        !this.amountsLocked() &&
        search !== null &&
        !this.searchInvalid()
        ? { scope, search }
        : undefined;
    },
    loader: ({ params }) => this.api.manualProducts(params.scope, params.search),
  });
  protected readonly suggestions = computed<VariantChoice[]>(() => {
    if (!this.products.hasValue() || this.products.isLoading()) {
      return [];
    }
    const labels = new Map(
      this.choices()
        ?.productOptions.filter(({ active }) => active)
        .flatMap(({ values }) => values.map(({ id, label }) => [id, label] as const)),
    );
    return this.products.value().items.flatMap(({ name, variants }) =>
      variants
        .filter(({ active }) => active)
        .map(({ id, sku, optionValueIds }) => ({
          id,
          label: [
            name,
            ...optionValueIds.flatMap((valueId) => labels.get(valueId) ?? []),
            sku,
          ].join(' · '),
        })),
    );
  });
  protected readonly variantEmptyMessage = computed(() => {
    if (this.products.isLoading()) {
      return this.shared().loading;
    }
    if (this.searchInvalid()) {
      return this.shared().searchTooManyWords;
    }
    if (this.products.error()) {
      return this.text().manualOrderProductsUnavailable;
    }
    return this.shared().table.noResultsTitle;
  });
  protected readonly pickerPt = innerInputPt;
  protected readonly contactFields = computed(
    () =>
      [
        { key: 'name', label: this.text().name, type: 'text' },
        { key: 'email', label: this.text().email, type: 'email' },
        { key: 'phone', label: this.text().orderPhone, type: 'tel' },
      ] as const,
  );
  protected readonly addressFields = computed(
    () =>
      [
        { key: 'line1', label: this.text().orderAddressLine1, required: true, wide: true },
        { key: 'line2', label: this.text().orderAddressLine2, required: false, wide: true },
        { key: 'city', label: this.text().orderCity, required: true, wide: false },
        { key: 'postalCode', label: this.text().orderPostalCode, required: true, wide: false },
        { key: 'countryCode', label: this.text().orderCountryCode, required: true, wide: false },
      ] as const,
  );

  constructor() {
    effect(() => {
      this.params();
      const order = this.loadedOrder();
      this.autofilledContact.clear();
      this.form.reset({
        customerId: order?.customerId ?? '',
        ...(order && {
          contact: order.contact,
          shippingAddress: { ...order.shippingAddress, line2: order.shippingAddress.line2 ?? '' },
        }),
        merchantNote: order?.merchantNote ?? '',
        paymentMethodId: order?.paymentMethodId ?? '',
        shippingMethodId: order?.shippingMethodId ?? '',
      });
      this.resetLines(order?.lines ?? []);
      this.search.set(null);
      this.errors.set({});
      this.saveError.set(null);
    });
    lockWhileSaving(this.form, this.saving, () => {
      this.focusError();
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected customerChanged(): void {
    this.clearError('customerId');
    const selected = this.customerOptions().find(
      ({ id }) => id === this.form.controls.customerId.value,
    );
    if (!selected) {
      return;
    }
    const contact = this.form.controls.contact.controls;
    for (const key of contactKeys) {
      const field = contact[key];
      if (field.pristine && (this.autofilledContact.has(key) || !field.value.trim())) {
        field.setValue(selected[key]);
        this.autofilledContact.add(key);
        this.clearError(`contact.${key}`);
      }
    }
  }

  protected searchVariants(value: string): void {
    this.search.set(normalizeSearch(value));
  }

  protected addLine(value: unknown): void {
    const variant = this.suggestions().find((item) => item === value);
    this.form.controls.variantPicker.reset();
    if (!variant || this.saving()) {
      return;
    }
    this.clearError('lines');
    if (this.lines.controls.some((line) => line.controls.choice.value.variantId === variant.id)) {
      this.errors.update((errors) => ({ ...errors, lines: this.text().orderVariantDuplicate }));
      return;
    }
    this.lines.push(this.lineForm({ variantId: variant.id, label: variant.label }, 1));
    this.form.markAsDirty();
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.form.markAsDirty();
    this.errors.update((errors) =>
      Object.fromEntries(
        Object.entries(errors).filter(([path]) => path !== 'lines' && !path.startsWith('lines.')),
      ),
    );
    afterNextRender(
      () => {
        const path = index < this.lines.length ? `lines.${String(index)}.quantity` : 'lines';
        this.formElement()?.nativeElement.ownerDocument.getElementById(`manual-${path}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected clearError(path: string): void {
    this.errors.update((errors) => ({ ...errors, [path]: undefined }));
    this.saveError.set(null);
  }

  protected error(
    path: string,
    control: AbstractControl | null = this.form.get(path),
  ): string | null {
    return (
      this.errors()[path] ??
      (control?.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected lineError(index: number): string | null {
    return (
      this.error(`lines.${String(index)}.quantity`) ??
      this.error(`lines.${String(index)}.variantId`)
    );
  }

  protected lineChanged(index: number): void {
    this.clearError(`lines.${String(index)}.quantity`);
    this.clearError(`lines.${String(index)}.variantId`);
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (!params || this.saving() || !this.canEdit()) {
      return;
    }
    const isCurrent = () => !this.destroyRef.destroyed && this.params() === params;
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(null);
    const {
      customerId,
      contact,
      shippingAddress,
      merchantNote,
      paymentMethodId,
      shippingMethodId,
      lines,
    } = this.form.getRawValue();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const fields = {
      customerId: customerId || null,
      contact,
      shippingAddress,
      merchantNote: merchantNote || null,
      paymentMethodId,
    };
    this.saving.set(true);
    try {
      const recordId = params.id
        ? await this.api.updateManual(params.scope, params.id, {
            ...fields,
            ...(!this.amountsLocked() && {
              shippingMethodId,
              lines: lines.map(({ choice, quantity }) => ({
                ...(choice.lineId ? { lineId: choice.lineId } : { variantId: choice.variantId }),
                quantity: quantity ?? 0,
              })),
            }),
          })
        : await this.api.createManual(params.scope, {
            ...fields,
            shippingMethodId,
            lines: lines.map(({ choice, quantity }) => ({
              variantId: choice.variantId ?? '',
              quantity: quantity ?? 0,
            })),
          });
      if (!isCurrent()) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ recordId, message: this.text().manualOrderSaved });
      this.drawer().close();
    } catch (error: unknown) {
      if (!isCurrent()) {
        return;
      }
      const text = this.text();
      const reasons: Record<string, string> = {
        INVALID_METHOD: text.orderMethodUnavailable,
        MANUAL_ORDER_AMOUNTS_LOCKED: text.manualOrderAmountsLocked,
        MANUAL_ORDER_NOT_EDITABLE: text.manualOrderNotEditable,
        ORDER_CUSTOMER_UNAVAILABLE: text.orderCustomerUnavailable,
        ORDER_STOCK_SHORT: text.orderStockShort,
        ORDER_VARIANT_DUPLICATE: text.orderVariantDuplicate,
        ORDER_VARIANT_UNAVAILABLE: text.orderVariantUnavailable,
      };
      const paths = [
        ...this.focusOrder(),
        ...lines.map((_, index) => `lines.${String(index)}.variantId`),
        'order',
      ];
      const wireErrors = fieldErrors(
        error,
        paths.map(operatorFieldPath),
        params.scope.language,
        (code) => reasons[code],
      );
      const { order: orderErrorCode } = fieldErrors(
        error,
        ['order'],
        params.scope.language,
        (code) => code,
      );
      if (orderErrorCode === 'MANUAL_ORDER_AMOUNTS_LOCKED' && params.id) {
        const saved = await this.api.find(params.scope, params.id).catch(() => null);
        if (!isCurrent()) {
          return;
        }
        if (saved?.invoice) {
          this.order.set(saved);
          this.resetLines(saved.lines);
          this.form.controls.shippingMethodId.reset(saved.shippingMethodId ?? '');
        }
      }
      const messages = Object.fromEntries(
        paths.flatMap((path) => {
          const message = wireErrors[operatorFieldPath(path)];
          return message ? [[path, message]] : [];
        }),
      );
      this.errors.set(messages);
      this.saveError.set(
        messages['order'] ?? (Object.keys(messages).length ? null : text.manualOrderSaveFailed),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private resetLines(lines: OperatorOrderDetailFragment['lines']): void {
    this.lines.clear();
    for (const { id, variantId, label, sku, quantity } of lines) {
      this.lines.push(
        this.lineForm({ lineId: id, variantId, label: `${label} · ${sku}` }, quantity),
      );
    }
    this.lines.markAsPristine();
  }

  private lineForm(choice: LineChoice, quantity: number): LineForm {
    return this.builder.group({
      choice,
      quantity: new FormControl<number | null>(quantity, [
        required,
        Validators.min(1),
        Validators.max(2_147_483_647),
        Validators.pattern(/^\d+$/u),
      ]),
    });
  }

  private focusOrder(): string[] {
    return [
      'customerId',
      ...contactPaths,
      ...addressPaths,
      'lines',
      ...this.lines.controls.map((_, index) => `lines.${String(index)}.quantity`),
      'shippingMethodId',
      'paymentMethodId',
      'merchantNote',
    ];
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (form && focusFirstInvalid(form, this.focusOrder(), 'manual-')) {
      form.ownerDocument.activeElement
        ?.closest('osnova-form-field')
        ?.scrollIntoView({ block: 'nearest' });
    } else {
      this.drawer().focusTitle();
    }
  }
}
