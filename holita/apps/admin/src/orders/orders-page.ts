import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
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
  normalizeSearch,
  searchApplies,
  tableView,
  trackById,
  uiMessages,
  zonedWallTimeToIso,
  type DrawerHost,
  type FilterCodec,
  type MenuChoice,
  type PageHeaderAction,
  type FilterCondition,
  type FilterField,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { AutoComplete } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  OperatorOrdersQuery,
  OperatorOrderSummaryFragment,
  OrderCustomerType,
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
import { OrderNotifications } from './order-notifications';

type OrdersAction = 'open';
type OrdersListPage = OperatorOrdersQuery['orders'];
type CustomerOption = { id: string; label: string };
type PlacedDate = Omit<FilterCondition, 'id' | 'field'>;
type OrderFilters = {
  status: readonly OrderStatus[] | undefined;
  placedFrom: string | undefined;
  placedTo: string | undefined;
  placedDates: readonly PlacedDate[] | undefined;
  paymentMethod: readonly string[] | undefined;
  paymentMethodId: readonly string[] | undefined;
  shippingMethod: readonly string[] | undefined;
  shippingMethodId: readonly string[] | undefined;
  customerType: readonly OrderCustomerType[] | undefined;
  customerId: readonly string[] | undefined;
};

const customerTypes = ['PROFILE', 'GUEST'] as const satisfies readonly OrderCustomerType[];
const methodFields = ['paymentMethod', 'shippingMethod'] as const;
const dateOperators = ['between', 'on', 'after', 'before'] as const;
const maxMethodValues = 100;
const methodIds = codecs.idList(maxMethodValues);

// Encode each saved label before joining it so a comma in a label survives the list URL codec.
const methodLabels: FilterCodec<readonly string[]> = {
  read: (values) => {
    const labels = values.flatMap((value) => {
      try {
        const label = decodeURIComponent(value);
        return label && Array.from(label).length <= 200 && !label.includes('\u0000') ? [label] : [];
      } catch {
        return [];
      }
    });
    return labels.length ? [...new Set(labels)].slice(0, maxMethodValues).sort() : undefined;
  },
  write: (values) => (values?.length ? [...values].sort().map(encodeURIComponent).join(',') : null),
  same: (left, right) =>
    left?.length === right?.length && (left?.every((label) => right?.includes(label)) ?? true),
};

const dateOnly = codecs.dateOnly();
const placedDates: FilterCodec<readonly PlacedDate[]> = {
  read: (entries) => {
    const conditions = entries.flatMap((entry) => {
      const [name, start, end] = entry.split(':');
      const operator = dateOperators.find((candidate) => candidate === name);
      const first = start && dateOnly.read([start]);
      const last = end && dateOnly.read([end]);
      if (!operator || !first || (operator === 'between' && (!last || last < first))) {
        return [];
      }
      return [{ operator, values: operator === 'between' && last ? [first, last] : [first] }];
    });
    return conditions.length ? conditions : undefined;
  },
  write: (conditions) =>
    conditions?.length
      ? conditions.map(({ operator, values }) => [operator, ...values].join(':')).join(',')
      : null,
  same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
};

function methodChoices(
  linked: readonly { id: string; label: string }[],
  legacy: readonly string[],
  legacyLabel: string,
) {
  const labels = new Map<string, number>();
  for (const { label } of linked) {
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  return [
    ...linked.map(({ id, label }) => ({
      value: 'id:' + id,
      label: (labels.get(label) ?? 0) > 1 ? `${label} · ${id}` : label,
    })),
    ...legacy.map((label) => ({ value: 'label:' + label, label: `${label} · ${legacyLabel}` })),
  ];
}

function orderMethodValues(values: readonly string[]) {
  const labels = values
    .filter((value) => value.startsWith('label:'))
    .map((value) => value.slice(6));
  return {
    ids: methodIds.read(
      values.filter((value) => value.startsWith('id:')).map((value) => value.slice(3)),
    ),
    labels: labels.length ? labels : undefined,
  };
}

const statusFilter = codecs.enumList(orderStatuses);
const customerTypeFilter = codecs.enumList(customerTypes);
const definition: ListDefinition<OrderFilters, 'PLACED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'PLACED_AT', direction: 'DESC' },
  filters: {
    status: statusFilter,
    placedFrom: dateOnly,
    placedTo: dateOnly,
    placedDates,
    paymentMethod: methodLabels,
    paymentMethodId: methodIds,
    shippingMethod: methodLabels,
    shippingMethodId: methodIds,
    customerType: customerTypeFilter,
    customerId: codecs.idList(1),
  },
  normalizeFilter: ({ placedFrom, placedTo, ...filter }) =>
    placedFrom && placedTo && placedFrom > placedTo ? filter : { ...filter, placedFrom, placedTo },
};

function orderDateBoundary(value: string, timeZone: string, followingDay = false): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (followingDay) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return zonedWallTimeToIso(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
}

function orderDateBounds(dates: readonly PlacedDate[], timeZone: string) {
  let placedAtFrom: string | undefined;
  let placedAtBefore: string | undefined;
  for (const {
    operator,
    values: [day, end],
  } of dates) {
    if (!day) {
      continue;
    }
    if (operator !== 'before') {
      const from = orderDateBoundary(day, timeZone, operator === 'after');
      placedAtFrom = !placedAtFrom || from > placedAtFrom ? from : placedAtFrom;
    }
    if (operator !== 'after') {
      const before = orderDateBoundary(end ?? day, timeZone, operator !== 'before');
      placedAtBefore = !placedAtBefore || before < placedAtBefore ? before : placedAtBefore;
    }
  }
  return { placedAtFrom, placedAtBefore };
}

@Component({
  selector: 'holita-orders-page',
  imports: [
    AutoComplete,
    ButtonDirective,
    FilterBuilder,
    Message,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    RouterOutlet,
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
  private readonly notifications = inject(OrderNotifications);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
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
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.api.canWrite() ? [{ id: 'new', label: this.text().createManualOrder, primary: true }] : [],
  );
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (message) {
        this.messages.add({ severity: 'success', summary: message });
      }
      this.list.reload();
      this.filterMethods.reload();
      this.notifications.reload();
    },
  };
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
  protected readonly filterMethods = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params, abortSignal }) => this.api.filterMethods(params, abortSignal),
  });
  private readonly methodOptions = computed(() =>
    this.filterMethods.hasValue() ? this.filterMethods.value() : null,
  );
  protected readonly filteredCustomerId = computed(() => this.url.state().filter.customerId?.[0]);
  private readonly selectedCustomer = resource({
    params: () => {
      const scope = this.scope();
      const id = this.filteredCustomerId();
      return scope && id ? { scope, id } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.filterCustomer(params.scope, params.id, abortSignal),
  });
  private readonly customerSearch = linkedSignal({
    source: this.scope,
    computation: (): string | null => null,
  });
  private readonly customerSearchInvalid = computed(
    () => !searchApplies(this.customerSearch() ?? ''),
  );
  protected readonly customerPicker = new FormControl<CustomerOption | string | null>(null);
  private readonly customers = resource({
    params: () => {
      const scope = this.scope();
      const search = this.customerSearch();
      return scope && search !== null && !this.customerSearchInvalid()
        ? { scope, search }
        : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.manualCustomers(params.scope, params.search, abortSignal),
  });
  protected readonly customerOptions = computed<CustomerOption[]>(() =>
    this.customers.hasValue()
      ? this.customers.value().map(({ id, name, email }) => ({ id, label: `${name} · ${email}` }))
      : [],
  );
  protected readonly customerEmptyMessage = computed(() => {
    if (this.customerSearchInvalid()) {
      return this.shared().searchTooManyWords;
    }
    if (this.customers.isLoading()) {
      return this.shared().loading;
    }
    return this.customers.error()
      ? this.text().manualOrderCustomersUnavailable
      : this.shared().table.noResultsTitle;
  });
  protected readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'status',
      label: this.text().orderStatus,
      type: 'enum',
      operators: ['isAnyOf'],
      options: orderStatuses.map((status) => ({
        value: status,
        label: this.statusText(status, this.language()),
      })),
    },
    {
      key: 'placedAt',
      label: this.text().orderDate,
      type: 'date',
      operators: dateOperators,
    },
    {
      key: 'shippingMethod',
      label: this.text().orderShippingMethod,
      type: 'enum',
      operators: ['isAnyOf'],
      options: methodChoices(
        this.methodOptions()?.shippingMethods ?? [],
        this.methodOptions()?.shippingMethodLabels ?? [],
        this.text().orderLegacyMethod,
      ),
      maxValues: maxMethodValues,
    },
    {
      key: 'paymentMethod',
      label: this.text().orderPaymentMethod,
      type: 'enum',
      operators: ['isAnyOf'],
      options: methodChoices(
        this.methodOptions()?.paymentMethods ?? [],
        this.methodOptions()?.paymentMethodLabels ?? [],
        this.text().orderLegacyMethod,
      ),
      maxValues: maxMethodValues,
    },
    {
      key: 'customerType',
      label: this.text().orderCustomerType,
      type: 'enum',
      operators: ['isAnyOf'],
      options: [
        { value: 'PROFILE', label: this.text().orderRegisteredCustomer },
        { value: 'GUEST', label: this.text().orderGuestCustomer },
      ],
    },
  ]);
  private readonly dateConditions = computed<readonly PlacedDate[]>(() => {
    const { placedFrom, placedTo, placedDates } = this.url.state().filter;
    if (placedDates) {
      return placedDates;
    }
    const day = placedFrom ?? placedTo;
    if (placedFrom && placedTo) {
      return [
        {
          operator: placedFrom === placedTo ? 'on' : 'between',
          values: placedFrom === placedTo ? [placedFrom] : [placedFrom, placedTo],
        },
      ];
    }
    return day ? [{ operator: placedFrom ? 'after' : 'before', values: [day] }] : [];
  });
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const filter = this.url.state().filter;
    const fields: ReadonlyArray<readonly [string, readonly string[] | undefined]> = [
      ['status', filter.status],
      ['customerType', filter.customerType],
      ...methodFields.map(
        (field) =>
          [
            field,
            [
              ...(filter[`${field}Id`] ?? []).map((id) => 'id:' + id),
              ...(filter[field] ?? []).map((label) => 'label:' + label),
            ],
          ] as const,
      ),
    ];
    return [
      ...fields.flatMap<FilterCondition>(([field, values]) =>
        values?.length ? [{ id: field, field, operator: 'isAnyOf', values }] : [],
      ),
      ...this.dateConditions().map((condition, index) => ({
        ...condition,
        id: `placedAt-${String(index)}`,
        field: 'placedAt',
      })),
    ];
  });
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, filter } = this.url.state();
    const { timeZone } = this.format.preferences();
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            customerId: this.filteredCustomerId(),
            filter: {
              statuses: filter.status ? [...filter.status] : undefined,
              ...orderDateBounds(this.dateConditions(), timeZone),
              paymentMethodIds: filter.paymentMethodId ? [...filter.paymentMethodId] : undefined,
              paymentMethodLabels: filter.paymentMethod ? [...filter.paymentMethod] : undefined,
              shippingMethodIds: filter.shippingMethodId ? [...filter.shippingMethodId] : undefined,
              shippingMethodLabels: filter.shippingMethod ? [...filter.shippingMethod] : undefined,
              customerTypes: filter.customerType ? [...filter.customerType] : undefined,
            },
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
      filtered:
        !!this.url.state().search || this.conditions().length > 0 || !!this.filteredCustomerId(),
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));

  constructor() {
    effect(() => {
      this.restoreCustomerSelection();
    });
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
    const byField = new Map(conditions.map((condition) => [condition.field, condition]));
    const dates = conditions
      .filter(({ field }) => field === 'placedAt')
      .map(({ operator, values }) => ({ operator, values }));
    const payment = orderMethodValues(byField.get('paymentMethod')?.values ?? []);
    const shipping = orderMethodValues(byField.get('shippingMethod')?.values ?? []);
    this.url.patchFilter({
      status: statusFilter.read(byField.get('status')?.values ?? []),
      placedFrom: undefined,
      placedTo: undefined,
      placedDates: dates.length ? dates : undefined,
      paymentMethod: payment.labels,
      paymentMethodId: payment.ids,
      shippingMethod: shipping.labels,
      shippingMethodId: shipping.ids,
      customerType: customerTypeFilter.read(byField.get('customerType')?.values ?? []),
    });
  }

  protected searchCustomers(query: string): void {
    this.customerSearch.set(normalizeSearch(query));
  }

  protected applyCustomer(): void {
    const customer = this.customerPicker.value;
    if (customer && typeof customer !== 'string') {
      this.url.patchFilter({ customerId: [customer.id] });
    }
  }

  protected clearCustomer(): void {
    this.customerSearch.set(null);
    this.customerPicker.setValue(null);
    this.url.patchFilter({ customerId: undefined });
  }

  protected restoreCustomerSelection(): void {
    const id = this.filteredCustomerId();
    const customer = this.selectedCustomer.hasValue() ? this.selectedCustomer.value() : null;
    const label =
      customer && customer.id === id
        ? `${customer.name} · ${customer.email}`
        : this.text().chooseCustomer;
    this.customerPicker.setValue(id ? { id, label } : null);
  }

  protected run(request: ListActionRequest<OrdersAction>): void {
    const id = request.ids[0];
    if (id) {
      this.open(id);
    }
  }

  protected headerAction({ id }: MenuChoice): void {
    if (id === 'new' && this.api.canWrite()) {
      this.open(id);
    }
  }

  private open(path: string): void {
    this.url.cancelPending();
    void this.router.navigate([path], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
