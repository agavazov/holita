import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  ListSortMenu,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  formatNumber,
  injectDisplayFormat,
  injectSortReady,
  listQuery,
  listRecord,
  localeOf,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type ListQuery,
  type MenuChoice,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  DiscountSortField,
  OperatorDiscountFieldsFragment,
  OperatorDiscountsQuery,
} from '../generated/discounts-operations';
import { DiscountsApi } from './discounts-api';

type DiscountAction = 'edit';
type DiscountListPage = OperatorDiscountsQuery['discounts'];
const definition: ListDefinition<Record<string, never>, DiscountSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'code', field: 'CODE' },
    { param: 'status', field: 'ENABLED' },
  ],
  defaultSort: { field: 'CODE', direction: 'ASC' },
  filters: {},
};

function isDecimal(value: string): value is `${number}` {
  return /^\d+(?:\.\d+)?$/.test(value);
}

@Component({
  selector: 'holita-discounts-page',
  imports: [
    FilterBuilder,
    ListSortMenu,
    Message,
    PageHeader,
    RouterOutlet,
    RowActions,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './discounts-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountsPage {
  private readonly api = inject(DiscountsApi);
  private readonly language = inject(OperatorLanguage).value;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly sortReady = injectSortReady();
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly canWrite = this.api.canWrite;
  protected readonly format = injectDisplayFormat();
  protected readonly tableMinWidth = '54rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'new', label: this.text().newDiscount, primary: true }] : [],
  );
  protected readonly actions = computed<
    readonly ListAction<DiscountAction, OperatorDiscountFieldsFragment>[]
  >(() => (this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : []));
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'CODE',
      label: this.text().discountCode,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'ENABLED',
      label: this.text().status,
      width: '8.5rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    { id: 'value', label: this.text().discountValue, width: '8rem', kind: 'number' },
    {
      id: 'window',
      label: this.text().discountValidity,
      width: '18rem',
      kind: 'date',
    },
    { id: 'uses', label: this.text().discountUses, width: '8rem', kind: 'number' },
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
  protected readonly sortFields = computed(() => [
    { field: 'CODE', label: this.text().discountCode },
    { field: 'ENABLED', label: this.text().status },
  ]);
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort } = this.url.state();
    return scope
      ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search, sort } }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.list(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<DiscountsApi['scope']>; data: DiscountListPage | undefined },
    DiscountListPage | null
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
      filtered: !!this.url.state().search,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost = computed(() => {
    const scope = this.scope();
    return {
      saved: ({ message }) => {
        if (scope === this.scope()) {
          this.messages.add({ severity: 'success', summary: message });
          this.list.reload();
        }
      },
    } satisfies DrawerHost;
  });

  constructor() {
    effect(() => {
      const data = this.list.hasValue() && !this.list.isLoading() ? this.list.value() : null;
      if (data) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }

  protected record(discount: OperatorDiscountFieldsFragment) {
    return listRecord(this.actions(), discount, discount.id, discount.code);
  }

  protected rate(discount: OperatorDiscountFieldsFragment): string {
    const percent = discount.type === 'PERCENTAGE';
    return new Intl.NumberFormat(localeOf(this.language()), {
      ...(percent
        ? { style: 'percent', maximumFractionDigits: 2 }
        : { style: 'currency', currency: discount.currency, minimumFractionDigits: 2 }),
    }).format(
      percent
        ? Number(discount.value) / 100
        : isDecimal(discount.value)
          ? discount.value
          : Number.NaN,
    );
  }

  protected uses(discount: OperatorDiscountFieldsFragment): string {
    const used = formatNumber(discount.redeemedCount, this.language());
    return discount.usageLimit === null
      ? used
      : `${used} / ${formatNumber(discount.usageLimit, this.language())}`;
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    const field = definition.sorts.find((candidate) => candidate.field === sort.field)?.field;
    if (field) {
      this.url.setSort(field, sort.direction === 'asc' ? 'ASC' : 'DESC');
    }
  }

  protected tableSort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) {
      return;
    }
    const sort = listQuery.sorted(
      { ...this.url.state(), sort: this.sort(), conditions: [] },
      event,
    )?.sort;
    if (sort) {
      this.changeSort(sort);
    }
  }

  protected headerAction({ id }: MenuChoice): void {
    if (id === 'new' && this.canWrite()) {
      this.open(id);
    }
  }

  protected run(request: ListActionRequest<DiscountAction>): void {
    const id = request.ids[0];
    if (id && this.canWrite()) {
      this.open(id);
    }
  }

  private open(id: string): void {
    this.url.cancelPending();
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
