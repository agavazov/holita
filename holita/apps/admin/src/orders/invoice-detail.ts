import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  EmptyState,
  PageHeader,
  TablePanel,
  formatDateOnly,
  formatNumber,
  injectDisplayFormat,
  injectPageRecord,
  interpolate,
  tableView,
  uiMessages,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { orderAmount, orderPaymentSeverity, orderPaymentText } from './order-format';
import { OrdersApi, orderIdPattern } from './orders-api';

@Component({
  selector: 'holita-invoice-detail',
  imports: [ButtonDirective, EmptyState, PageHeader, Skeleton, TableModule, TablePanel, Tag],
  templateUrl: './invoice-detail.html',
  styles: `
    .invoice-address {
      white-space: pre-wrap;
    }

    @media print {
      .invoice-amounts {
        break-inside: avoid;
      }
    }
  `,
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetail {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly messages = inject(MessageService);
  protected readonly fromRegister = this.route.snapshot.data['fromInvoiceRegister'] === true;
  private readonly byId = this.route.snapshot.data['invoiceById'] === true;
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly id = computed(() => this.routeParams().get('recordId') ?? '');
  protected readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  private readonly format = injectDisplayFormat();
  protected readonly amount = orderAmount;
  protected readonly quantity = formatNumber;
  protected readonly paymentText = orderPaymentText;
  protected readonly paymentSeverity = orderPaymentSeverity;
  protected readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && orderIdPattern.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) =>
      this.byId
        ? this.api.invoiceById(params.scope, params.id)
        : this.api.invoice(params.scope, params.id),
  });
  protected readonly invoice = computed(() =>
    this.record.hasValue() ? this.record.value() : null,
  );
  protected readonly title = computed(() => {
    const invoice = this.invoice();
    return invoice
      ? interpolate(this.text().invoiceTitle, { number: invoice.number })
      : this.text().invoice;
  });
  private readonly downloading = signal(false);
  protected readonly downloadActions = computed<readonly PageHeaderAction[]>(() =>
    this.invoice()
      ? [
          {
            id: 'download',
            label: this.text().downloadInvoicePdf,
            primary: true,
            loading: this.downloading(),
          },
        ]
      : [],
  );
  protected readonly backLink = computed(() =>
    this.fromRegister
      ? ['/', this.language(), 'invoices']
      : ['/', this.language(), 'orders', this.id()],
  );
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
  protected readonly lineView = computed(() =>
    tableView({
      loading: false,
      error: null,
      rows: this.invoice()?.lines.length ?? 0,
      filtered: false,
    }),
  );

  constructor() {
    injectPageRecord(
      () => (this.invoice() ? this.title() : null),
      () => {
        const fragment = this.fragment();
        const path = this.fromRegister ? 'invoices' : 'orders';
        return this.router.createUrlTree(['/', this.language(), path], {
          queryParams: this.queryParams(),
          ...(fragment ? { fragment } : {}),
        });
      },
    );
  }

  protected async download(): Promise<void> {
    const scope = this.api.scope();
    const invoice = this.invoice();
    if (!scope || !invoice || this.downloading()) {
      return;
    }
    this.downloading.set(true);
    try {
      const pdf = await this.api.downloadInvoice(scope, invoice);
      const url = URL.createObjectURL(pdf);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.number}.pdf`;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    } catch {
      this.messages.add({ severity: 'error', summary: this.text().invoiceDownloadFailed });
    } finally {
      this.downloading.set(false);
    }
  }

  protected date(value: string): string {
    return formatDateOnly(value, this.language(), this.format.preferences().dateFormat);
  }
}
