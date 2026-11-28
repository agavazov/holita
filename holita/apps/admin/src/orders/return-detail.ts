import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
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
  errorCode,
  formatNumber,
  injectDisplayFormat,
  injectPageRecord,
  tableView,
  uiMessages,
  type DrawerHost,
  type TableColumn,
} from '@osnova/ui';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { OrderReturnOutcome } from '../generated/orders-operations';
import { orderAmount } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';
import { returnStatusSeverity, returnStatusText } from './return-format';

type ReturnParams = { scope: NonNullable<ReturnType<OrdersApi['scope']>>; id: string };
type ReturnAction = OrderReturnOutcome | 'COMPLETE';

@Component({
  selector: 'holita-return-detail',
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
  ],
  providers: [ConfirmationService],
  templateUrl: './return-detail.html',
  styles: `
    .return-reason {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnDetail {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly injector = inject(Injector);
  private readonly historyHeading = viewChild<ElementRef<HTMLHeadingElement>>('historyHeading');
  private readonly refundHeading = viewChild<ElementRef<HTMLHeadingElement>>('refundHeading');
  private focusRefundOnClose = false;
  private readonly abort = new AbortController();
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  protected readonly scope = this.api.scope;
  protected readonly canDecide = this.api.canDecideReturn;
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly format = injectDisplayFormat();
  protected readonly amount = orderAmount;
  protected readonly statusText = returnStatusText;
  protected readonly statusSeverity = returnStatusSeverity;
  protected readonly formatNumber = formatNumber;
  protected readonly backLink = computed(() => ['/', this.language(), 'returns']);
  private readonly params = computed<ReturnParams | undefined>(() => {
    const scope = this.scope();
    const id = this.routeParams().get('recordId');
    return scope && id && orderIdPattern.test(id) ? { scope, id } : undefined;
  });
  protected readonly record = resource({
    params: this.params,
    loader: ({ params, abortSignal }) => this.api.returnCase(params.scope, params.id, abortSignal),
  });
  protected readonly item = computed(() => (this.record.hasValue() ? this.record.value() : null));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ recordId, message }) => {
      if (recordId === this.params()?.id) {
        this.focusRefundOnClose = true;
        this.record.reload();
        if (message) {
          this.messages.add({ severity: 'success', summary: message });
        }
      }
    },
  };
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'item',
      label: this.text().orderItem,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'quantity', label: this.text().returnRequestedQuantity, width: '9rem', kind: 'number' },
  ]);
  protected readonly linesView = computed(() =>
    tableView({
      loading: false,
      error: null,
      rows: this.item()?.lines.length ?? 0,
      filtered: false,
    }),
  );
  protected readonly pending = signal<ReturnAction | null>(null);
  private readonly focusHistoryAfterReload = signal<ReturnParams | null>(null);
  private readonly actionError = signal<{ params: ReturnParams; message: string } | null>(null);
  protected readonly error = computed(() => {
    const error = this.actionError();
    return error && error.params === this.params() ? error.message : null;
  });
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'return-decision-question'),
  );
  protected readonly confirmQuestion = computed(() => {
    const text = this.text();
    const action = this.pending();
    return action
      ? {
          APPROVED: text.approveReturnConfirm,
          REJECTED: text.rejectReturnConfirm,
          COMPLETE: text.completeReturnWithoutRefundConfirm,
        }[action]
      : '';
  });

  constructor() {
    injectPageRecord(
      () => this.item()?.orderNumber ?? null,
      () => {
        const fragment = this.fragment();
        return this.router.createUrlTree(this.backLink(), {
          queryParams: this.queryParams(),
          ...(fragment ? { fragment } : {}),
        });
      },
    );
    inject(DestroyRef).onDestroy(() => {
      this.abort.abort();
    });
    effect(() => {
      const params = this.focusHistoryAfterReload();
      if (params && !this.record.isLoading()) {
        this.focusHistoryAfterReload.set(null);
        if (this.params() === params) {
          this.focusHistory();
        }
      }
    });
  }

  protected refundDrawerClosed(): void {
    if (this.focusRefundOnClose) {
      this.focusRefundOnClose = false;
      afterNextRender(() => this.refundHeading()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  protected async runAction(action: ReturnAction, opener: HTMLButtonElement): Promise<void> {
    const params = this.params();
    const item = this.item();
    const completing = action === 'COMPLETE';
    const allowed = completing ? item?.canCompleteWithoutRefund : item?.status === 'PENDING';
    if (!params || !this.canDecide() || !allowed || this.pending()) {
      return;
    }
    this.pending.set(action);
    this.actionError.set(null);
    const { scope, id } = params;
    const text = this.text();
    const label = {
      APPROVED: text.approveReturn,
      REJECTED: text.rejectReturn,
      COMPLETE: text.completeReturnWithoutRefund,
    }[action];
    const isCurrent = () => this.params() === params && !this.abort.signal.aborted;
    try {
      const accepted = await confirmAction(this.confirm, scope.language, {
        header: label,
        acceptLabel: label,
        danger: action === 'REJECTED',
        signal: this.abort.signal,
      });
      if (!isCurrent()) {
        return;
      }
      if (!accepted) {
        afterNextRender(
          () => {
            opener.focus();
          },
          { injector: this.injector },
        );
        return;
      }
      const result = completing
        ? await this.api.completeReturnWithoutRefund(scope, id)
        : await this.api.decideReturn(scope, id, action);
      if (isCurrent()) {
        this.record.set(result);
        this.focusHistory();
        this.messages.add({
          severity: 'success',
          summary: completing ? text.returnCompletedWithoutRefund : text.returnDecisionSaved,
        });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        const conflict = errorCode(error) === 'CONFLICT';
        this.actionError.set({
          params,
          message: completing
            ? text.returnCompletionFailed
            : conflict
              ? text.returnDecisionConflict
              : text.returnDecisionFailed,
        });
        if (conflict) {
          this.record.reload();
          if (completing) {
            this.focusHistoryAfterReload.set(params);
          }
        }
      }
    } finally {
      this.pending.set(null);
    }
  }

  private focusHistory(): void {
    afterNextRender(() => this.historyHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
