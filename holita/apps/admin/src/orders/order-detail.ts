import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  EmptyState,
  PageHeader,
  TablePanel,
  confirmAction,
  confirmDialogPt,
  fieldErrors,
  formatNumber,
  injectDisplayFormat,
  injectPageRecord,
  interpolate,
  tableView,
  uiMessages,
  type DrawerHost,
  type MenuChoice,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Timeline } from 'primeng/timeline';
import {
  orderAmount,
  orderPaymentSeverity,
  orderPaymentText,
  orderStatusSeverity,
  orderStatusText,
} from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

type OrderDetailParams = { scope: NonNullable<ReturnType<OrdersApi['scope']>>; id: string };

@Component({
  selector: 'holita-order-detail',
  imports: [
    ButtonDirective,
    ConfirmDialog,
    EmptyState,
    Message,
    PageHeader,
    RouterLink,
    RouterOutlet,
    Skeleton,
    TableModule,
    TablePanel,
    Tag,
    Timeline,
  ],
  providers: [ConfirmationService],
  templateUrl: './order-detail.html',
  styles: `
    .order-payment-instructions,
    .order-refund-reason {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetail {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmAbort = new AbortController();
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });
  private readonly id = computed(() => this.routeParams().get('recordId') ?? '');
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly format = injectDisplayFormat();
  protected readonly amount = orderAmount;
  protected readonly quantity = formatNumber;
  protected readonly statusText = orderStatusText;
  protected readonly statusSeverity = orderStatusSeverity;
  protected readonly paymentText = orderPaymentText;
  protected readonly paymentSeverity = orderPaymentSeverity;
  protected readonly scope = this.api.scope;
  protected readonly validId = computed(() => orderIdPattern.test(this.id()));
  private readonly params = computed(() => {
    const scope = this.scope();
    return scope && this.validId() ? { scope, id: this.id() } : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly order = computed(() => (this.record.hasValue() ? this.record.value() : null));
  protected readonly title = computed(() => {
    const order = this.order();
    return order
      ? interpolate(this.text().orderTitle, { number: order.number })
      : this.text().order;
  });
  private readonly paymentBusy = signal(false);
  private readonly actionError = signal<{
    params: OrderDetailParams;
    message: string;
  } | null>(null);
  protected readonly paymentError = computed(() => {
    const error = this.actionError();
    return error && error.params === this.params() ? error.message : null;
  });
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'mark-order-paid-message'),
  );
  protected readonly actions = computed<readonly PageHeaderAction[]>(() => {
    const order = this.order();
    if (!this.api.canWrite() || !order) {
      return [];
    }
    const disabled = this.paymentBusy() || this.record.isLoading();
    const canUpdate = order.nextStatuses.length > 0;
    return [
      ...(canUpdate
        ? [{ id: 'status', label: this.text().updateOrderStatus, primary: true, disabled }]
        : []),
      ...(order.canMarkPaid
        ? [{ id: 'paid', label: this.text().markOrderPaid, primary: !canUpdate, disabled }]
        : []),
      ...(order.refundSummary?.canRecordRefund
        ? [{ id: 'record-refund', label: this.text().recordRefund, primary: !canUpdate, disabled }]
        : []),
      ...(!order.invoice
        ? [
            {
              id: 'create-invoice',
              label: this.text().createInvoice,
              primary: !canUpdate && !order.canMarkPaid && !order.refundSummary?.canRecordRefund,
              disabled,
            },
          ]
        : []),
    ];
  });
  protected readonly lineColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'item',
      label: this.text().orderItem,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'quantity', label: this.text().orderQuantity, width: '4rem', kind: 'number' },
    {
      id: 'unitPrice',
      label: this.text().orderUnitPrice,
      width: '8rem',
      kind: 'number',
      className: 'app-table-merged-column',
    },
    { id: 'total', label: this.text().orderTotal, width: '6.5rem', kind: 'number' },
  ]);
  protected readonly linesMinWidth = '34rem';
  protected readonly lineView = computed(() =>
    tableView({
      loading: false,
      error: null,
      rows: this.order()?.lines.length ?? 0,
      filtered: false,
    }),
  );
  protected readonly refundColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'date',
      label: this.text().refundDate,
      width: '13rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'amount', label: this.text().refundAmount, width: '8rem', kind: 'number' },
    {
      id: 'reason',
      label: this.text().refundReason,
      width: 'auto',
      className: 'app-table-merged-column',
    },
    {
      id: 'restock',
      label: this.text().refundRestockRequested,
      width: '11rem',
      className: 'app-table-merged-column',
    },
  ]);
  protected readonly refundView = computed(() =>
    tableView({
      loading: false,
      error: null,
      rows: this.order()?.refundSummary?.refunds.length ?? 0,
      filtered: false,
    }),
  );
  protected readonly history = computed(() => {
    const order = this.order();
    return order
      ? [
          { fromStatus: null, toStatus: 'PLACED', occurredAt: order.placedAt },
          ...order.statusChanges,
        ]
      : [];
  });
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message, recordId }) => {
      if (recordId === this.id()) {
        if (message) {
          this.messages.add({ severity: 'success', summary: message });
        }
        this.record.reload();
      }
    },
  };

  constructor() {
    injectPageRecord(
      () => this.order()?.number ?? null,
      () => {
        const fragment = this.fragment();
        return this.router.createUrlTree(['/', this.language(), 'orders'], {
          queryParams: this.queryParams(),
          ...(fragment ? { fragment } : {}),
        });
      },
    );
    this.destroyRef.onDestroy(() => {
      this.confirmAbort.abort();
    });
  }

  protected async run({ id }: MenuChoice): Promise<void> {
    if (id === 'status' || id === 'create-invoice' || id === 'record-refund') {
      void this.router.navigate([id === 'status' ? 'fulfillment' : id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    } else if (id === 'paid') {
      await this.markPaid();
    }
  }

  private async markPaid(): Promise<void> {
    const params = this.params();
    const order = this.order();
    if (!params || !this.api.canWrite() || !order?.canMarkPaid || this.paymentBusy()) {
      return;
    }

    this.paymentBusy.set(true);
    this.actionError.set(null);
    const { scope, id } = params;
    try {
      const accepted = await confirmAction(this.confirmation, scope.language, {
        header: this.text().markOrderPaid,
        acceptLabel: this.text().markOrderPaid,
        danger: false,
        signal: this.confirmAbort.signal,
      });
      if (!accepted || !this.isCurrent(params)) {
        return;
      }

      await this.api.markPaid(scope, id);
      if (!this.isCurrent(params)) {
        return;
      }
      this.record.reload();
      this.messages.add({ severity: 'success', summary: this.text().orderPaymentSaved });
    } catch (error: unknown) {
      if (!this.isCurrent(params)) {
        return;
      }
      const { paymentStatus } = fieldErrors(error, ['paymentStatus'], scope.language, (code) =>
        code === 'ORDER_PAYMENT_REJECTED' ? this.text().orderPaymentRejected : undefined,
      );
      this.actionError.set({
        params,
        message: paymentStatus ?? this.text().orderPaymentSaveFailed,
      });
    } finally {
      this.paymentBusy.set(false);
    }
  }

  private isCurrent(params: OrderDetailParams): boolean {
    return !this.destroyRef.destroyed && this.params() === params;
  }
}
