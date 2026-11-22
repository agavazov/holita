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
  confirmAction,
  confirmDialogPt,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  lockWhileSaving,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import type { OrderStatus } from '../generated/orders-operations';
import { orderStatusSeverity, orderStatusText } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

@Component({
  selector: 'holita-order-status-editor',
  imports: [
    ButtonDirective,
    ConfirmDialog,
    FormField,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    Tag,
  ],
  providers: [ConfirmationService],
  templateUrl: './order-status-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusEditor {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage).value;
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly confirmation = inject(ConfirmationService);
  private readonly confirmAbort = new AbortController();
  private readonly host = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly routeParams = toSignal((this.route.parent ?? this.route).paramMap, {
    requireSync: true,
  });
  private readonly id = computed(
    () => this.routeParams().get(this.routeData.recordParam ?? 'recordId') ?? '',
  );
  private readonly params = computed(() => {
    const scope = this.api.scope();
    const id = this.id();
    return scope && orderIdPattern.test(id) ? { scope, id } : undefined;
  });
  private readonly record = resource({
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
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly statusText = orderStatusText;
  protected readonly statusSeverity = orderStatusSeverity;
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'cancel-order-message'),
  );
  protected readonly statusOptions = computed(() =>
    (this.order()?.nextStatuses ?? []).map((status) => ({
      value: status,
      label: this.statusText(status, this.language()),
    })),
  );
  protected readonly canUpdate = computed(
    () => this.api.canWrite() && this.statusOptions().length > 0,
  );
  protected readonly saving = signal(false);
  protected readonly confirming = signal(false);
  protected readonly saveError = signal(false);
  private readonly serverError = signal<string | null>(null);
  protected readonly form = new FormGroup({
    status: new FormControl<OrderStatus | null>(null, {
      validators: [(control) => Validators.required(control)],
    }),
  });

  constructor() {
    effect(() => {
      this.params();
      this.form.reset({ status: null }, { emitEvent: false });
      this.clearError();
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
    this.destroyRef.onDestroy(() => {
      this.confirmAbort.abort();
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && !this.confirming() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected currentStatusText(status: OrderStatus): string {
    return this.statusText(status, this.language());
  }

  protected statusError(): string | null {
    const control = this.form.controls.status;
    return (
      this.serverError() ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }

  protected clearError(): void {
    this.serverError.set(null);
    this.saveError.set(false);
  }

  protected retry(): void {
    this.record.reload();
  }

  protected async save(): Promise<void> {
    const params = this.params();
    if (
      !params ||
      !this.canUpdate() ||
      this.saving() ||
      this.confirming() ||
      this.state() !== 'ready'
    ) {
      return;
    }
    this.form.markAllAsTouched();
    this.clearError();
    const { status } = this.form.getRawValue();
    if (this.form.invalid || status === null) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const { scope, id } = params;
    if (status === 'CANCELLED') {
      this.confirming.set(true);
      const accepted = await confirmAction(this.confirmation, scope.language, {
        header: this.text().cancelOrder,
        acceptLabel: this.text().cancelOrder,
        danger: true,
        signal: this.confirmAbort.signal,
      });
      this.confirming.set(false);
      if (!accepted || this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
    }

    this.saving.set(true);
    try {
      const recordId = await this.api.updateStatus(scope, id, status);
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().orderStatusSaved, recordId });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.params() !== params) {
        return;
      }
      const { status: message } = fieldErrors(error, ['status'], scope.language, (code) =>
        code === 'ORDER_STATUS_REJECTED' ? this.text().orderStatusRejected : undefined,
      );
      this.serverError.set(message ?? null);
      this.saveError.set(!message);
    } finally {
      this.saving.set(false);
    }
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    if (!form || !focusFirstInvalid(form, ['status'], 'order-')) {
      this.drawer().focusTitle();
    }
  }
}
