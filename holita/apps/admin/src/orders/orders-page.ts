import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  codecs,
  injectDisplayFormat,
  listRecord,
  tableView,
  trackById,
  uiMessages,
  type FilterCondition,
  type FilterField,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  OperatorOrdersQuery,
  OperatorOrderSummaryFragment,
  OrderStatus,
} from '../generated/orders-operations';
import {
  orderAmount,
  orderPaymentSeverity,
  orderPaymentText,
  orderStatuses,
  orderStatusSeverity,
  orderStatusText,
} from './order-format';
import { OrdersApi } from './orders-api';

type OrdersAction = 'open';
type OrdersListPage = OperatorOrdersQuery['orders'];
type OrderFilters = { status: readonly OrderStatus[] | undefined };
const definition: ListDefinition<OrderFilters, 'PLACED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'PLACED_AT', direction: 'DESC' },
  filters: { status: codecs.enumList(orderStatuses) },
  normalizeFilter: ({ status }) => ({ status: status?.slice(0, 1) }),
};

@Component({
  selector: 'holita-orders-page',
  imports: [
    FilterBuilder,
    Message,
    PageHeader,
    RouterLink,
    RowActions,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './orders-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  private readonly api = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly tableMinWidth = '43rem';
  protected readonly format = injectDisplayFormat();
  protected readonly amount = orderAmount;
  protected readonly statusText = orderStatusText;
  protected readonly statusSeverity = orderStatusSeverity;
  protected readonly paymentText = orderPaymentText;
  protected readonly paymentSeverity = orderPaymentSeverity;
  protected readonly trackById = trackById;
  protected readonly actions = computed<
    readonly ListAction<OrdersAction, OperatorOrderSummaryFragment>[]
  >(() => [{ id: 'open', label: this.text().openOrder }]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
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
      className: 'app-col-secondary',
    },
    {
      id: 'status',
      label: this.text().orderStatus,
      width: '9rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    { id: 'payment', label: this.text().orderPayment, width: '6.25rem', kind: 'status' },
    { id: 'total', label: this.text().orderTotal, width: '6.25rem', kind: 'number' },
    {
      id: 'actions',
      label: this.shared().pageHeader.actions,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'status',
      label: this.text().orderStatus,
      type: 'enum',
      operators: ['equals'],
      options: orderStatuses.map((status) => ({
        value: status,
        label: this.statusText(status, this.language()),
      })),
    },
  ]);
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const status = this.url.state().filter.status?.[0];
    return status ? [{ id: 'status', field: 'status', operator: 'equals', values: [status] }] : [];
  });
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, filter } = this.url.state();
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            status: filter.status?.[0] ?? null,
          },
        }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.list(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<OrdersApi['scope']>; data: OrdersListPage | undefined },
    OrdersListPage | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search || this.conditions().length > 0,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));

  constructor() {
    effect(() => {
      const data = this.list.hasValue() && !this.list.isLoading() ? this.list.value() : null;
      if (data) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }

  protected record(order: OperatorOrderSummaryFragment) {
    return listRecord(this.actions(), order, order.id, order.number);
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    const value = conditions.find(({ field }) => field === 'status')?.values[0];
    const status = orderStatuses.find((candidate) => candidate === value);
    this.url.patchFilter({ status: status ? [status] : undefined });
  }

  protected run(request: ListActionRequest<OrdersAction>): void {
    const id = request.ids[0];
    if (id) {
      this.url.cancelPending();
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    }
  }
}
