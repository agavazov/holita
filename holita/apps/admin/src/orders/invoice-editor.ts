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
  resource,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  dateOnlyValidator,
  datePickerInputPt,
  drawerParam,
  errorCode,
  fieldErrors,
  focusFirstInvalid,
  formatNumber,
  fromDateOnly,
  injectDisplayFormat,
  injectDrawerHost,
  isoToZonedWallTime,
  integerValidator,
  patternValidator,
  textValidator,
  lockWhileSaving,
  toDateOnly,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import type { InvoicePaymentStatus } from '../generated/orders-operations';
import { shopCurrency } from '../shop-currency';
import {
  InvoiceIssuerFields,
  invoiceIssuerForm,
  invoiceTextControl,
  issuerFieldKeys,
  issuerFormValues,
  type IssuerField,
} from './invoice-issuer-fields';
import { orderAmount } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

const lineFields = [
  { key: 'description', label: 'orderItem', required: true },
  { key: 'unit', label: 'invoiceLineUnit', required: false },
  { key: 'quantity', label: 'orderQuantity', required: true },
  { key: 'unitPrice', label: 'orderUnitPrice', required: true },
] as const;
type LineField = (typeof lineFields)[number]['key'];
type LineFieldPath = `lines.${string}.${LineField}`;

function standaloneLine() {
  return new FormGroup({
    description: invoiceTextControl(1000, true),
    unit: invoiceTextControl(32),
    quantity: new FormControl<number | null>(1, {
      validators: [integerValidator(1, 2_147_483_647, { required: true })],
    }),
    unitPrice: new FormControl('', {
      nonNullable: true,
      validators: [
        textValidator(13, { required: true }),
        patternValidator(/^\d{1,10}(?:[.,]\d{1,2})?$/u),
      ],
    }),
  });
}

@Component({
  selector: 'holita-invoice-editor',
  imports: [
    ButtonDirective,
    DatePicker,
    FormField,
    InputText,
    InvoiceIssuerFields,
    Message,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Textarea,
  ],
  templateUrl: './invoice-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceEditor {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly host = injectDrawerHost();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly parentParams = toSignal((this.route.parent ?? this.route).paramMap, {
    requireSync: true,
  });
  protected readonly standalone = this.route.snapshot.data['standaloneInvoice'] === true;
  private readonly id = computed(
    () => this.parentParams().get('recordId') ?? drawerParam(this.route, 'recordId') ?? '',
  );
  private readonly params = computed(() => {
    const scope = this.api.scope();
    const id = this.standalone ? null : this.id();
    return scope && (id === null || orderIdPattern.test(id)) ? { scope, id } : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: async ({ params }) => {
      const [issuer, order] = await Promise.all([
        this.api.issuerSettings(params.scope),
        params.id ? this.api.find(params.scope, params.id) : Promise.resolve(null),
      ]);
      return { issuer, order };
    },
  });
  protected readonly order = computed(() =>
    this.record.hasValue() ? this.record.value().order : null,
  );
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || this.record.error()) {
      return 'error';
    }
    if (!this.standalone && !orderIdPattern.test(this.id())) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    return this.standalone || this.order() ? 'ready' : 'not-found';
  });
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly amount = orderAmount;
  protected readonly currency = shopCurrency;
  protected readonly lineFields = lineFields;
  protected readonly paymentOptions = computed(() => [
    { id: 'UNPAID', label: this.text().orderUnpaid },
    { id: 'PAID', label: this.text().orderPaid },
  ]);
  protected readonly quantity = formatNumber;
  protected readonly format = injectDisplayFormat();
  protected readonly datePickerInputPt = datePickerInputPt;
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly conflict = signal(false);
  protected readonly alreadyIssued = computed(() => !!this.order()?.invoice || this.conflict());
  protected readonly canIssue = computed(
    () => this.api.canWrite() && this.state() === 'ready' && !this.alreadyIssued(),
  );
  protected readonly form = new FormGroup({
    number: invoiceTextControl(100, true),
    issueDate: new FormControl<Date | null>(null, {
      validators: [(control) => Validators.required(control), dateOnlyValidator(null, null)],
    }),
    taxEventDate: new FormControl<Date | null>(null, {
      validators: [dateOnlyValidator(null, null)],
    }),
    dueDate: new FormControl<Date | null>(null, {
      validators: [dateOnlyValidator(null, null)],
    }),
    paymentMethod: invoiceTextControl(200),
    paymentStatus: new FormControl<InvoicePaymentStatus>('UNPAID', { nonNullable: true }),
    paymentTermDays: new FormControl<number | null>(null, {
      validators: [integerValidator(0, 3650)],
    }),
    reason: invoiceTextControl(255),
    note: invoiceTextControl(5000),
    issuer: invoiceIssuerForm(true),
    recipientName: invoiceTextControl(200, true),
    recipientCompanyId: invoiceTextControl(100),
    recipientVatNumber: invoiceTextControl(100),
    recipientAddress: invoiceTextControl(1000, true),
    recipientEmail: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254), (control) => Validators.email(control)],
    }),
    recipientPhone: invoiceTextControl(100),
    lines: new FormArray<ReturnType<typeof standaloneLine>>([]),
    lineUnits: new FormArray<FormControl<string>>([]),
  });
  protected readonly lines = this.form.controls.lines;
  protected readonly lineUnits = this.form.controls.lineUnits;
  protected readonly errors = signal<Partial<Record<InvoiceErrorField, string>>>({});
  protected readonly documentFields: readonly InvoiceFieldConfig[] = [
    { key: 'number', label: 'invoiceNumber', required: true },
  ];
  protected readonly dateFields = [
    { key: 'issueDate', label: 'invoiceIssueDate', required: true },
    { key: 'taxEventDate', label: 'invoiceTaxEventDate', required: false },
    { key: 'dueDate', label: 'invoiceDueDate', required: false },
  ] as const;
  protected readonly paymentFields: readonly InvoiceFieldConfig[] = [
    { key: 'paymentMethod', label: 'orderPaymentMethod' },
    { key: 'reason', label: 'invoiceReason' },
    { key: 'note', label: 'invoiceNote', multiline: true },
  ];
  protected readonly recipientFields: readonly InvoiceFieldConfig[] = [
    { key: 'recipientName', label: 'name', required: true },
    { key: 'recipientCompanyId', label: 'companyId' },
    { key: 'recipientVatNumber', label: 'vatNumber' },
    { key: 'recipientEmail', label: 'email', type: 'email' },
    { key: 'recipientPhone', label: 'orderPhone', type: 'tel' },
    { key: 'recipientAddress', label: 'address', required: true, multiline: true },
  ] as const;

  constructor() {
    effect(() => {
      const data = this.record.hasValue() ? this.record.value() : null;
      const order = data?.order;
      const billing = order?.billingAddress;
      const address = billing ?? order?.shippingAddress;
      this.lines.clear();
      this.lineUnits.clear();
      if (this.standalone) {
        this.lines.push(standaloneLine());
      }
      if (order) {
        this.lineUnits.push(order.lines.map(() => invoiceTextControl(32)));
      }
      this.form.reset({
        issueDate: fromDateOnly(
          isoToZonedWallTime(
            new Date().toISOString(),
            untracked(() => this.format.preferences().timeZone),
          )?.slice(0, 10),
        ),
        ...(data ? { issuer: issuerFormValues(data.issuer) } : {}),
        paymentMethod: order?.paymentMethodLabel ?? '',
        paymentStatus: order?.paymentStatus ?? 'UNPAID',
        recipientName: billing?.name ?? order?.contact.name ?? '',
        recipientEmail: order?.contact.email ?? '',
        recipientPhone: billing?.phone ?? order?.contact.phone ?? '',
        recipientAddress: address
          ? [
              address.line1,
              address.line2,
              `${address.postalCode} ${address.city}`,
              address.countryCode,
            ]
              .filter(Boolean)
              .join('\n')
          : '',
        lines: this.standalone ? [{ quantity: 1 }] : [],
      });
      this.conflict.set(false);
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

  protected fieldLabel(field: InvoiceFieldConfig): string {
    return this.text()[field.label];
  }

  protected fieldError(field: InvoiceField): string | null {
    const control = this.form.controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected linePath(index: number, field: LineField): LineFieldPath {
    return `lines.${String(index)}.${field}`;
  }

  protected lineError(index: number, field: LineField): string | null {
    const control = this.lines.at(index).controls[field];
    return (
      this.errors()[this.linePath(index, field)] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected linkedUnitError(index: number): string | null {
    const control = this.lineUnits.at(index);
    return control.touched ? validationMessage(control.errors, this.language()) : null;
  }

  protected addLine(): void {
    this.lines.push(standaloneLine());
    this.lines.markAsDirty();
    this.clearError('lines');
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.lines.markAsDirty();
    this.errors.set({});
  }

  protected clearError(field: InvoiceErrorField): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (!params || !this.canIssue() || this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    const { issueDate, taxEventDate, dueDate, issuer, lines, lineUnits, ...values } =
      this.form.getRawValue();
    if (this.form.invalid || !issueDate) {
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
      const input = {
        ...values,
        ...issuer,
        issueDate: toDateOnly(issueDate),
        taxEventDate: taxEventDate ? toDateOnly(taxEventDate) : null,
        dueDate: dueDate ? toDateOnly(dueDate) : null,
      };
      const invoice = params.id
        ? await this.api.issueInvoice(params.scope, params.id, {
            ...input,
            lineUnits: (this.order()?.lines ?? []).flatMap((line, index) => {
              const unit = lineUnits[index]?.trim();
              return unit ? [{ orderLineId: line.id, unit }] : [];
            }),
          })
        : await this.api.issueStandaloneInvoice(params.scope, {
            ...input,
            lines: lines.map((line) => ({
              ...line,
              quantity: line.quantity ?? 0,
              unitPrice: line.unitPrice.trim().replace(',', '.'),
            })),
          });
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().invoiceIssued, recordId: params.id ?? invoice.id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      if (params.id && errorCode(error) === 'CONFLICT') {
        this.conflict.set(true);
        this.form.markAsPristine();
        this.host.saved({ message: '', recordId: params.id });
        return;
      }
      const errors = fieldErrors(error, this.errorFields(), params.scope.language, (code, path) => {
        if (code === 'INVOICE_NUMBER_USED') {
          return this.text().invoiceNumberUsed;
        }
        return path === 'lineUnits' ? this.text().invoiceOrderLinesChanged : undefined;
      });
      this.errors.set(errors);
      this.saveError.set(Object.keys(errors).length === 0);
    } finally {
      this.saving.set(false);
    }
  }

  private errorFields(): InvoiceErrorField[] {
    return [
      'number',
      'issueDate',
      'taxEventDate',
      'dueDate',
      'paymentTermDays',
      'paymentMethod',
      'reason',
      'note',
      ...issuerFieldKeys,
      ...this.recipientFields.map((field) => field.key),
      'lines',
      'lineUnits',
      ...this.lines.controls.flatMap((_, index) =>
        lineFields.map((field) => this.linePath(index, field.key)),
      ),
    ];
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (
      !form ||
      !focusFirstInvalid(
        form,
        [
          ...this.errorFields(),
          ...this.lineUnits.controls.map((_, index) => `lineUnits.${String(index)}`),
        ],
        'invoice-',
      )
    ) {
      this.drawer().focusTitle();
    }
  }
}

type InvoiceField = Exclude<
  keyof InvoiceEditor['form']['controls'],
  'issuer' | 'lines' | 'lineUnits'
>;
type InvoiceErrorField = InvoiceField | IssuerField | LineFieldPath | 'lines' | 'lineUnits';

interface InvoiceFieldConfig {
  key: InvoiceField;
  label: keyof typeof operatorStrings.en;
  required?: boolean;
  type?: 'email' | 'tel' | 'text';
  multiline?: boolean;
}
