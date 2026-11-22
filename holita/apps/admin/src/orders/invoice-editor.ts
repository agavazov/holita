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
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  lockWhileSaving,
  textValidator,
  toDateOnly,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { orderAmount } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

function textControl(max: number, required = false) {
  return new FormControl('', { nonNullable: true, validators: [textValidator(max, { required })] });
}

@Component({
  selector: 'holita-invoice-editor',
  imports: [
    ButtonDirective,
    DatePicker,
    FormField,
    InputText,
    Message,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouteDrawer,
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
  private readonly id = computed(
    () => this.parentParams().get('recordId') ?? drawerParam(this.route, 'recordId') ?? '',
  );
  private readonly params = computed(() => {
    const scope = this.api.scope();
    const id = this.id();
    return scope && orderIdPattern.test(id) ? { scope, id } : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly order = computed(() => (this.record.hasValue() ? this.record.value() : null));
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || this.record.error()) {
      return 'error';
    }
    if (!orderIdPattern.test(this.id())) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    return this.order() ? 'ready' : 'not-found';
  });
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly amount = orderAmount;
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
    () => this.api.canWrite() && !!this.order() && !this.alreadyIssued(),
  );
  protected readonly form = new FormGroup({
    number: textControl(100, true),
    issueDate: new FormControl<Date | null>(null, {
      validators: [(control) => Validators.required(control), dateOnlyValidator(null, null)],
    }),
    issuerName: textControl(200, true),
    issuerCompanyId: textControl(100, true),
    issuerAddress: textControl(1000, true),
    issuerVatNumber: textControl(100),
    recipientName: textControl(200, true),
    recipientCompanyId: textControl(100),
    recipientVatNumber: textControl(100),
    recipientAddress: textControl(1000, true),
    recipientEmail: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254), (control) => Validators.email(control)],
    }),
    recipientPhone: textControl(100),
  });
  private readonly fields = [
    'number',
    'issueDate',
    'issuerName',
    'issuerCompanyId',
    'issuerVatNumber',
    'issuerAddress',
    'recipientName',
    'recipientCompanyId',
    'recipientVatNumber',
    'recipientEmail',
    'recipientPhone',
    'recipientAddress',
  ] as const;
  private readonly errors = signal<Partial<Record<InvoiceField, string>>>({});
  protected readonly documentFields: readonly InvoiceFieldConfig[] = [
    { key: 'number', label: 'invoiceNumber', required: true, type: 'text' },
  ] as const;
  protected readonly issuerFields: readonly InvoiceFieldConfig[] = [
    { key: 'issuerName', label: 'name', required: true },
    { key: 'issuerCompanyId', label: 'companyId', required: true },
    { key: 'issuerVatNumber', label: 'vatNumber' },
    { key: 'issuerAddress', label: 'address', required: true, multiline: true },
  ] as const;
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
      const order = this.order();
      if (order) {
        const address = order.shippingAddress;
        this.form.reset({
          issueDate: fromDateOnly(
            isoToZonedWallTime(new Date().toISOString(), this.format.preferences().timeZone)?.slice(
              0,
              10,
            ),
          ),
          recipientName: order.contact.name,
          recipientEmail: order.contact.email,
          recipientPhone: order.contact.phone,
          recipientAddress: [
            address.line1,
            address.line2,
            `${address.postalCode} ${address.city}`,
            address.countryCode,
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }
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

  protected clearError(field: InvoiceField): void {
    this.errors.update((errors) => ({ ...errors, [field]: undefined }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (!params || !this.canIssue() || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    const { issueDate, ...values } = this.form.getRawValue();
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
      const invoice = await this.api.issueInvoice(params.scope, params.id, {
        ...values,
        issueDate: toDateOnly(issueDate),
      });
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().invoiceIssued, recordId: invoice.orderId });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      if (errorCode(error) === 'CONFLICT') {
        this.conflict.set(true);
        this.form.markAsPristine();
        this.host.saved({ message: '', recordId: params.id });
        return;
      }
      const errors = fieldErrors(error, this.fields, params.scope.language, (code) =>
        code === 'INVOICE_NUMBER_USED' ? this.text().invoiceNumberUsed : undefined,
      );
      this.errors.set(errors);
      this.saveError.set(Object.keys(errors).length === 0);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, this.fields, 'invoice-')) {
      this.drawer().focusTitle();
    }
  }
}

type InvoiceField = keyof InvoiceEditor['form']['controls'];

interface InvoiceFieldConfig {
  key: InvoiceField;
  label: keyof typeof operatorStrings.en;
  required?: boolean;
  type?: 'email' | 'tel' | 'text';
  multiline?: boolean;
}
