import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  EmptyState,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  injectDisplayFormat,
  injectPageRecord,
  listRecord,
  tableView,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type MenuChoice,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  OperatorCustomerAddressFragment,
  OperatorCustomerOrdersQuery,
} from '../generated/customers-operations';
import {
  orderAmount,
  orderPaymentSeverity,
  orderPaymentText,
  orderStatusSeverity,
  orderStatusText,
} from '../orders/order-format';
import { injectCustomerRecord } from './customer-record';
import { CustomersApi } from './customers-api';

type AddressAction = 'edit';
type OrdersPage = OperatorCustomerOrdersQuery['orders'];
type CustomerParams = ReturnType<ReturnType<typeof injectCustomerRecord>['params']>;

const orderHistory: ListDefinition<Record<string, never>, 'PLACED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'PLACED_AT', direction: 'DESC' },
  filters: {},
};

@Component({
  selector: 'holita-customer-detail',
  imports: [
    ButtonDirective,
    EmptyState,
    Message,
    PageHeader,
    RouterLink,
    RouterOutlet,
    RowActions,
    Skeleton,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './customer-detail.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetail {
  private readonly api = inject(CustomersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly customerRecord = injectCustomerRecord(this.route);
  protected readonly record = this.customerRecord.record;
  protected readonly profile = this.customerRecord.profile;
  protected readonly validId = this.customerRecord.validId;
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly scope = this.api.scope;
  protected readonly canWrite = this.api.canWrite;
  protected readonly format = injectDisplayFormat();
  protected readonly amount = orderAmount;
  protected readonly statusText = orderStatusText;
  protected readonly statusSeverity = orderStatusSeverity;
  protected readonly paymentText = orderPaymentText;
  protected readonly paymentSeverity = orderPaymentSeverity;
  protected readonly trackById = trackById;
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  protected readonly backQuery = computed(() => ({
    page: this.queryParams().get('customersPage'),
    pageSize: this.queryParams().get('customersPageSize'),
  }));
  protected readonly backLink = computed(() => ['/', this.language(), 'customers']);
  protected readonly drawerHost = computed<DrawerHost>(() => {
    const params = this.customerRecord.params();
    return {
      closeLink: [...this.backLink(), this.customerRecord.id()],
      saved: ({ message, recordId }) => {
        if (
          !params ||
          params !== this.customerRecord.params() ||
          recordId?.toLowerCase() !== params.id.toLowerCase()
        ) {
          return;
        }
        this.record.reload();
        if (message) {
          this.messages.add({ severity: 'success', summary: message });
        }
      },
    };
  });
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() && this.profile()
      ? [{ id: 'contact', label: this.text().editCustomerContact, primary: true }]
      : [],
  );
  protected readonly addressActions = computed<
    readonly ListAction<AddressAction, OperatorCustomerAddressFragment>[]
  >(() => (this.canWrite() ? [{ id: 'edit', label: this.text().editCustomerAddress }] : []));
  protected readonly addressColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'recipient',
      label: this.text().addressRecipient,
      width: '23%',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'street',
      label: this.text().addressStreet,
      width: 'auto',
      className: 'app-table-merged-column',
    },
    {
      id: 'city',
      label: this.text().orderCity,
      width: '9rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'postalCode',
      label: this.text().orderPostalCode,
      width: '7rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'countryCode',
      label: this.text().orderCountryCode,
      width: '6.5rem',
      className: 'app-table-merged-column',
    },
    ...(this.canWrite()
      ? [
          {
            id: 'actions',
            label: this.shared().pageHeader.actions,
            width: '3.25rem',
            kind: 'actions' as const,
            className: 'app-col-actions',
          },
        ]
      : []),
  ]);
  protected readonly addressView = computed(() =>
    tableView({
      loading: this.record.isLoading(),
      error: this.record.error(),
      rows: this.profile()?.addresses.length ?? null,
      filtered: false,
    }),
  );
  protected readonly orderColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'number',
      label: this.text().order,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'placedAt',
      label: this.text().orderDate,
      width: '10rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
    {
      id: 'status',
      label: this.text().orderStatus,
      width: '9rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    {
      id: 'payment',
      label: this.text().orderPayment,
      width: '6.5rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    { id: 'total', label: this.text().orderTotal, width: '7rem', kind: 'number' },
  ]);
  protected readonly url = new UrlListState(orderHistory, () => !!this.customerRecord.params());
  private readonly pageNumber = computed(() => this.url.state().page);
  private readonly pageSize = computed(() => this.url.state().pageSize);
  protected readonly orders = resource({
    params: () => {
      const customer = this.customerRecord.params();
      const page = this.pageNumber();
      const pageSize = this.pageSize();
      return customer
        ? {
            scope: customer.scope,
            variables: { customerId: customer.id, offset: (page - 1) * pageSize, limit: pageSize },
          }
        : undefined;
    },
    loader: ({ params }) => this.api.orders(params.scope, params.variables),
  });
  protected readonly orderPage = linkedSignal<
    {
      customer: CustomerParams;
      data: OrdersPage | undefined;
    },
    OrdersPage | null
  >({
    source: () => ({
      customer: this.customerRecord.params(),
      data: this.orders.hasValue() ? this.orders.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ??
      (previous?.source.customer === current.customer ? (previous?.value ?? null) : null),
  });
  protected readonly orderView = computed(() =>
    tableView({
      loading: this.orders.isLoading(),
      error: this.orders.error(),
      rows: this.orderPage()?.items.length ?? null,
      filtered: false,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.pageNumber(),
    pageSize: this.pageSize(),
    total: this.orderPage()?.total ?? 0,
  }));

  constructor() {
    injectPageRecord(
      () => this.profile()?.customer.name ?? null,
      () => {
        const fragment = this.fragment();
        return this.router.createUrlTree(this.backLink(), {
          queryParams: this.backQuery(),
          ...(fragment === null ? {} : { fragment }),
        });
      },
    );
    effect(() => {
      if (this.profile() && this.orders.hasValue() && !this.orders.isLoading()) {
        this.url.correctPage(Math.ceil(this.orders.value().total / this.pageSize()));
      }
    });
  }

  protected runHeaderAction({ id }: MenuChoice): void {
    if (id === 'contact' && this.canWrite()) {
      this.open(id);
    }
  }

  protected addressRecord(address: OperatorCustomerAddressFragment) {
    return listRecord(this.addressActions(), address, address.id, address.recipient);
  }

  protected runAddressAction({ ids }: ListActionRequest<AddressAction>): void {
    const [id] = ids;
    if (id && this.canWrite()) {
      this.open(id);
    }
  }

  private open(path: string): void {
    void this.router.navigate([path], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
