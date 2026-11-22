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
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  FilterBuilder,
  ListSortMenu,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  codecs,
  injectSortReady,
  listQuery,
  listRecord,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
  type DrawerHost,
  type FilterCondition,
  type FilterField,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type ListQuery,
  type TableColumn,
  type PageHeaderAction,
} from '@osnova/ui';
import { DemoSession, requestError } from '@osnova/ui/app';
import { OperatorLanguage, operatorStrings as strings } from '@holita/operator';
import { type OperatorProductsQuery, type ProductStatus } from '../generated/products-operations';
import { ProductsApi } from './products-api';

type ProductPage = OperatorProductsQuery['products'];
type Product = ProductPage['items'][number];
type ProductSort = 'NAME' | 'PRICE' | 'STATUS';
const statuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
const statusCodec = codecs.enumList(statuses);
const definition: ListDefinition<{ statuses: readonly ProductStatus[] | undefined }, ProductSort> =
  {
    pageSizes: [10, 20, 50, 100],
    defaultPageSize: 20,
    sorts: [
      { param: 'name', field: 'NAME' },
      { param: 'price', field: 'PRICE' },
      { param: 'status', field: 'STATUS' },
    ],
    defaultSort: { field: 'NAME', direction: 'ASC' },
    filters: { statuses: statusCodec },
  };

@Component({
  selector: 'holita-products-page',
  imports: [
    FilterBuilder,
    ListSortMenu,
    PageHeader,
    TablePanel,
    TableModule,
    RowActions,
    Tag,
    Message,
    RouterOutlet,
  ],
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
})
export class ProductsPage {
  readonly language = inject(OperatorLanguage);
  readonly session = inject(DemoSession);
  private readonly api = inject(ProductsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  readonly scope = this.api.scope;
  readonly tableMinWidth = '25rem';
  readonly url = new UrlListState(definition, () => !!this.scope());
  readonly trackById = trackById;
  private readonly sortReady = injectSortReady();
  readonly text = computed(() => strings[this.language.value()]);
  readonly shared = computed(() => uiMessages[this.language.value()]);
  private readonly price = computed(
    () => new Intl.NumberFormat(this.language.value(), { style: 'currency', currency: 'BGN' }),
  );
  readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort, filter } = this.url.state();
    return scope ? { scope, page, pageSize, search, sort, filter } : undefined;
  });
  readonly list = resource({
    params: this.params,
    loader: ({ params: { scope, page, pageSize, search, sort, filter } }) =>
      this.api.list(scope, {
        offset: (page - 1) * pageSize,
        limit: pageSize,
        search,
        sort,
        filter: filter.statuses ? { statuses: [...filter.statuses] } : null,
      }),
  });
  readonly page = linkedSignal<
    { scope: ReturnType<ProductsApi['scope']>; data: ProductPage | undefined },
    ProductPage | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  readonly error = computed(() => {
    const error = this.list.error();
    return error ? requestError(error, this.text().unavailable) : null;
  });
  readonly conditions = computed<readonly FilterCondition[]>(() => {
    const active = this.url.state().filter.statuses;
    return active ? [{ id: 'status', field: 'status', operator: 'isAnyOf', values: active }] : [];
  });
  readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().createProduct, primary: true }] : [],
  );
  readonly rowActions = computed<readonly ListAction<'edit', Product>[]>(() =>
    this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : [],
  );
  readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'NAME',
      label: this.text().name,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'PRICE', label: this.text().price, width: 'clamp(6.75rem, 13vw, 7rem)', kind: 'number' },
    { id: 'STATUS', label: this.text().status, width: 'clamp(6rem, 13vw, 7.5rem)', kind: 'status' },
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
  readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search || this.conditions().length > 0,
    }),
  );
  readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  readonly statusOptions = computed(() => [
    { value: 'DRAFT', label: this.text().draft },
    { value: 'ACTIVE', label: this.text().active },
    { value: 'ARCHIVED', label: this.text().archived },
  ]);
  readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'status',
      label: this.text().status,
      type: 'enum',
      operators: ['isAnyOf'],
      options: this.statusOptions(),
    },
  ]);
  readonly sortFields = computed(() => [
    { field: 'NAME', label: this.text().name },
    { field: 'PRICE', label: this.text().price },
    { field: 'STATUS', label: this.text().status },
  ]);
  statusLabel(value: ProductStatus): string {
    return this.statusOptions().find((option) => option.value === value)?.label ?? value;
  }
  statusTone(value: ProductStatus) {
    return toneSeverity(value === 'ACTIVE' ? 'success' : value === 'DRAFT' ? 'warn' : 'neutral');
  }
  formatPrice(value: string | null): string {
    return value === null ? '—' : this.price().format(Number(value));
  }
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
    },
  };
  constructor() {
    effect(() => {
      const data = this.list.hasValue() && !this.list.isLoading() ? this.list.value() : null;
      if (data) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }
  record(product: Product) {
    return listRecord(this.rowActions(), product, product.id, product.name);
  }
  run(request: ListActionRequest<'edit'>): void {
    const row = this.page()?.items.find((item) => item.id === request.ids[0]);
    if (row && this.canWrite()) {
      this.open(row.id);
    }
  }
  changeConditions(value: readonly FilterCondition[]): void {
    this.url.patchFilter({ statuses: statusCodec.read(value[0]?.values ?? []) });
  }
  changeSort(sort: NonNullable<ListQuery['sort']>): void {
    const field = definition.sorts.find((candidate) => candidate.field === sort.field)?.field;
    if (field) {
      this.url.setSort(field, sort.direction === 'asc' ? 'ASC' : 'DESC');
    }
  }
  tableSort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) {
      return;
    }
    const sort = listQuery.sorted(
      { ...this.url.state(), sort: this.sort(), conditions: this.conditions() },
      event,
    )?.sort;
    if (sort) {
      this.changeSort(sort);
    }
  }
  open(id: string): void {
    if (this.canWrite()) {
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    }
  }
}
