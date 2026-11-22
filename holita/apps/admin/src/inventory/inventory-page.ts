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
  codecs,
  formatNumber,
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
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  InventorySortField,
  OperatorInventoryQuery,
  OperatorInventoryVariantFieldsFragment,
} from '../generated/inventory-operations';
import { InventoryApi } from './inventory-api';
import { variantLabel } from './variant-label';

type InventoryAction = 'adjust';
type InventoryListPage = OperatorInventoryQuery['inventory'];
type InventoryFilters = { inventoryTracked: boolean | undefined; outOfStock: boolean | undefined };
const definition: ListDefinition<InventoryFilters, InventorySortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'product', field: 'PRODUCT_NAME' },
    { param: 'quantity', field: 'QUANTITY' },
    { param: 'sku', field: 'SKU' },
  ],
  defaultSort: { field: 'PRODUCT_NAME', direction: 'ASC' },
  filters: { inventoryTracked: codecs.boolean(), outOfStock: codecs.boolean() },
  normalizeFilter: ({ inventoryTracked, outOfStock }) => ({
    inventoryTracked,
    outOfStock: outOfStock || undefined,
  }),
};

@Component({
  selector: 'holita-inventory-page',
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
  templateUrl: './inventory-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  private readonly api = inject(InventoryApi);
  private readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly sortReady = injectSortReady();
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly tableMinWidth = '40.5rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly actions = computed<
    readonly ListAction<InventoryAction, OperatorInventoryVariantFieldsFragment>[]
  >(() =>
    this.canWrite()
      ? [
          {
            id: 'adjust',
            label: this.text().inventoryAdjust,
            appliesTo: (row) => row.inventoryTracked,
          },
        ]
      : [],
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'PRODUCT_NAME',
      label: this.text().inventoryProduct,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'QUANTITY', label: this.text().variantQuantity, width: '8rem', kind: 'number' },
    { id: 'tracking', label: this.text().inventoryTracking, width: '8rem', kind: 'status' },
    { id: 'SKU', label: this.text().variantSku, width: '11.5rem', kind: 'text' },
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
    { field: 'PRODUCT_NAME', label: this.text().inventoryProduct },
    { field: 'QUANTITY', label: this.text().variantQuantity },
    { field: 'SKU', label: this.text().variantSku },
  ]);
  protected readonly filterFields = computed<readonly FilterField[]>(() => {
    const tracking: FilterField = {
      key: 'inventoryTracked',
      label: this.text().inventoryTracking,
      type: 'boolean',
      operators: ['isTrue', 'isFalse'],
    };
    const stock: FilterField = {
      key: 'outOfStock',
      label: this.text().inventoryOutOfStock,
      type: 'boolean',
      operators: ['isTrue'],
    };
    return this.url.state().filter.inventoryTracked === undefined
      ? [tracking, stock]
      : [stock, tracking];
  });
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const { inventoryTracked, outOfStock } = this.url.state().filter;
    const conditions: FilterCondition[] = [];
    if (inventoryTracked !== undefined) {
      conditions.push({
        id: 'inventoryTracked',
        field: 'inventoryTracked',
        operator: inventoryTracked ? 'isTrue' : 'isFalse',
        values: [],
      });
    }
    if (outOfStock) {
      conditions.push({ id: 'outOfStock', field: 'outOfStock', operator: 'isTrue', values: [] });
    }
    return conditions;
  });
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort, filter } = this.url.state();
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            sort,
            filter: {
              ...(filter.inventoryTracked === undefined
                ? {}
                : { inventoryTracked: filter.inventoryTracked }),
              ...(filter.outOfStock ? { outOfStock: true } : {}),
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
    { scope: ReturnType<InventoryApi['scope']>; data: InventoryListPage | undefined },
    InventoryListPage | null
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
  protected readonly drawerHost: DrawerHost = {
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

  protected record(variant: OperatorInventoryVariantFieldsFragment) {
    return listRecord(
      this.actions(),
      variant,
      variant.id,
      `${variant.productName} · ${variant.sku}`,
    );
  }

  protected variant(variant: OperatorInventoryVariantFieldsFragment): string {
    return variantLabel(variant, this.text().defaultVariant);
  }

  protected quantity(value: number): string {
    return formatNumber(value, this.language.value());
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    const current = this.conditions();
    // The API has one value per field. A newly applied condition replaces the previous value.
    const applied = conditions.find(
      (next) =>
        !current.some(
          ({ id, field, operator }) =>
            id === next.id && field === next.field && operator === next.operator,
        ),
    );
    const tracked =
      applied?.field === 'inventoryTracked'
        ? applied
        : conditions.find(({ field }) => field === 'inventoryTracked');
    this.url.patchFilter({
      inventoryTracked: tracked && tracked.operator === 'isTrue',
      outOfStock: conditions.some(({ field }) => field === 'outOfStock') || undefined,
    });
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
      { ...this.url.state(), sort: this.sort(), conditions: this.conditions() },
      event,
    )?.sort;
    if (sort) {
      this.changeSort(sort);
    }
  }

  protected run(request: ListActionRequest<InventoryAction>): void {
    const id = request.ids[0];
    if (id) {
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    }
  }
}
