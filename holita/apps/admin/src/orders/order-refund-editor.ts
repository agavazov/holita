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
  drawerParam,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  uiMessages,
  type RouteDrawerState,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { orderAmount } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

const refundFields = ['amount', 'reason', 'restock'] as const;
type RefundField = (typeof refundFields)[number];

function parseAmount(value: string) {
  const wire = value.trim().replace(',', '.');
  if (!/^\d{1,30}(?:\.\d{1,2})?$/u.test(wire)) {
    return null;
  }
  const [whole = '0', fraction = ''] = wire.split('.');
  return { wire, cents: BigInt(whole + fraction.padEnd(2, '0')) };
}

@Component({
  selector: 'holita-order-refund-editor',
  imports: [
    ButtonDirective,
    Checkbox,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Textarea,
  ],
  templateUrl: './order-refund-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderRefundEditor {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly parentParams = toSignal((this.route.parent ?? this.route).paramMap, {
    requireSync: true,
  });
  private readonly id = computed(
    () => this.parentParams().get('recordId') ?? drawerParam(this.route, 'recordId') ?? '',
  );
  private readonly host = injectDrawerHost();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
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
  protected readonly refund = computed(() => this.order()?.refundSummary ?? null);
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
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  private readonly errors = signal<Partial<Record<RefundField, string | undefined>>>({});
  protected readonly canRecord = computed(
    () => this.api.canWrite() && !!this.refund()?.canRecordRefund,
  );
  private readonly balance = computed(
    () => parseAmount(this.refund()?.refundableAmount ?? '')?.cents ?? 0n,
  );
  protected readonly form = new FormGroup({
    amount: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => {
          const raw: unknown = control.value;
          if (typeof raw !== 'string' || !raw.trim()) {
            return { required: true };
          }
          const value = parseAmount(raw);
          if (!value?.cents) {
            return { refundAmountInvalid: true };
          }
          return value.cents > this.balance() ? { refundExceedsBalance: true } : null;
        },
      ],
    }),
    reason: new FormControl('', { nonNullable: true }),
    restock: new FormControl(false, { nonNullable: true }),
  });
  private readonly amountText = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: '',
  });
  protected readonly canRestock = computed(
    () =>
      !!this.refund()?.canRestockOnCompletion &&
      parseAmount(this.amountText())?.cents === this.balance(),
  );

  constructor() {
    effect(() => {
      this.params();
      this.form.reset();
      this.errors.set({});
      this.saveError.set(false);
    });
    effect(() => {
      if (!this.canRestock()) {
        this.form.controls.restock.setValue(false, { emitEvent: false });
      }
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

  protected amountError(): string | null {
    const control = this.form.controls.amount;
    const error = this.errors().amount;
    if (error || !control.touched) {
      return error ?? null;
    }
    if (control.hasError('required')) {
      return this.shared().validation.required;
    }
    if (control.hasError('refundAmountInvalid')) {
      return this.text().refundAmountInvalid;
    }
    return control.hasError('refundExceedsBalance') ? this.text().refundExceedsBalance : null;
  }

  protected fieldError(field: 'reason' | 'restock'): string | null {
    return this.errors()[field] ?? null;
  }

  protected clearError(field: RefundField): void {
    this.errors.update((errors) => ({
      ...errors,
      [field]: undefined,
      ...(field === 'amount' ? { restock: undefined } : {}),
    }));
    this.saveError.set(false);
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (!params || !this.canRecord() || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.controls.amount.updateValueAndValidity();
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    const draft = this.form.getRawValue();
    const value = parseAmount(draft.amount);
    if (this.form.invalid || !value) {
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
      await this.api.recordRefund(params.scope, params.id, {
        amount: value.wire,
        reason: draft.reason,
        restock: this.canRestock() && draft.restock,
      });
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().refundSaved, recordId: params.id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      const text = this.text();
      const reasons = {
        REFUND_AMOUNT_INVALID: text.refundAmountInvalid,
        REFUND_EXCEEDS_BALANCE: text.refundExceedsBalance,
        REFUND_RESTOCK_UNAVAILABLE: text.refundRestockUnavailable,
        REFUND_INELIGIBLE: text.refundIneligible,
      };
      const errors = fieldErrors(
        error,
        refundFields,
        params.scope.language,
        (code) => Object.entries(reasons).find(([key]) => key === code)?.[1],
      );
      this.errors.set(errors);
      this.saveError.set(Object.keys(errors).length === 0);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, refundFields, 'refund-')) {
      this.drawer().focusTitle();
    }
  }
}
