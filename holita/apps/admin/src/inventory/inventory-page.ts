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
import { BrandsApi } from '../brands/brands-api';
import { CategoriesApi } from '../categories/categories-api';
import { categoryRows } from '../categories/category-tree';
import type {
  InventoryFilter,
  InventorySortField,
  InventoryStockStatus,
  OperatorInventoryQuery,
  OperatorInventoryVariantFieldsFragment,
} from '../generated/inventory-operations';
import { ProductsApi } from '../products/products-api';
import { InventoryApi } from './inventory-api';
import { variantLabel } from './variant-label';

type InventoryAction = 'open';
type InventoryListPage = OperatorInventoryQuery['inventory'];
type InventoryFilters = {
  inventoryTracked: boolean | undefined;
  outOfStock: boolean | undefined;
  brandId: readonly string[] | undefined;
  categoryId: readonly string[] | undefined;
  productActive: boolean | undefined;
  variantActive: boolean | undefined;
  stockStatus: InventoryStockStatus | 'ALL' | undefined;
  barcode: string | undefined;
  characteristicChoiceIds: readonly string[] | undefined;
};
const stockStatuses = ['IN_STOCK', 'OUT_OF_STOCK', 'ALL'] as const;
const definition: ListDefinition<InventoryFilters, InventorySortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'product', field: 'PRODUCT_NAME' },
    { param: 'quantity', field: 'QUANTITY' },
    { param: 'sku', field: 'SKU' },
  ],
  defaultSort: { field: 'PRODUCT_NAME', direction: 'ASC' },
  filters: {
    inventoryTracked: codecs.boolean(),
    outOfStock: codecs.boolean(),
    brandId: codecs.idList(1),
    categoryId: codecs.idList(1),
    productActive: codecs.boolean(),
    variantActive: codecs.boolean(),
    stockStatus: codecs.choice(stockStatuses, 'ALL'),
    barcode: {
      read: (parts) => {
        const value = parts.join(',').trim();
        return value && Array.from(value).length <= 255 && !value.includes('\u0000')
          ? value
          : undefined;
      },
      write: (value) => value ?? null,
      same: (a, b) => a === b,
    },
    characteristicChoiceIds: codecs.idList(100),
  },
  normalizeFilter: ({ outOfStock, ...filter }) => ({
    ...filter,
    stockStatus: outOfStock && filter.stockStatus === 'ALL' ? 'OUT_OF_STOCK' : filter.stockStatus,
  }),
};

function valueCondition(
  field: string,
  values: readonly string[] | undefined,
  operator: 'equals' | 'isAnyOf' = 'equals',
): FilterCondition[] {
  return values?.length ? [{ id: field, field, operator, values }] : [];
}

function activeValues(active: boolean | undefined): string[] {
  return active === undefined ? [] : [active ? 'ACTIVE' : 'INACTIVE'];
}

function activeFilter(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === 'ACTIVE';
}

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
  private readonly brands = inject(BrandsApi);
  private readonly categories = inject(CategoriesApi);
  private readonly products = inject(ProductsApi);
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
  private readonly brandOptions = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params, abortSignal }) => this.brands.options(params, abortSignal),
  });
  private readonly categoryOptions = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params }) => this.categories.list(params),
  });
  private readonly characteristicOptions = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params }) => this.products.characteristics(params, null),
  });
  protected readonly filterLoadErrors = computed(() => {
    const text = this.text();
    return [
      ...(this.brandOptions.error() ? [text.brandsUnavailable] : []),
      ...(this.categoryOptions.error() ? [text.categoriesUnavailable] : []),
      ...(this.characteristicOptions.error() ? [text.characteristicGroupsUnavailable] : []),
    ];
  });
  private readonly characteristicFields = computed(() =>
    (this.characteristicOptions.hasValue()
      ? this.characteristicOptions.value().groups
      : []
    ).flatMap((group) =>
      group.characteristics
        .filter(({ choices }) => choices.length > 0)
        .map(
          ({ id, name, choices }) =>
            ({
              key: `characteristic-${id}`,
              label: `${group.name} / ${name}`,
              type: 'enum',
              operators: ['isAnyOf'],
              options: choices.map(({ id, name }) => ({ value: id, label: name })),
            }) satisfies FilterField,
        ),
    ),
  );
  private readonly unknownChoices = computed(() => {
    const choices = new Set(
      this.characteristicFields().flatMap(({ options }) => options.map(({ value }) => value)),
    );
    return (this.url.state().filter.characteristicChoiceIds ?? []).filter((id) => !choices.has(id));
  });
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly tableMinWidth = '42.5rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly actions = computed<
    readonly ListAction<InventoryAction, OperatorInventoryVariantFieldsFragment>[]
  >(() => [{ id: 'open', label: this.text().inventoryOpenVariant }]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'PRODUCT_NAME',
      label: this.text().inventoryProduct,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'QUANTITY', label: this.text().variantQuantity, width: '8rem', kind: 'number' },
    {
      id: 'tracking',
      label: this.text().inventoryTracking,
      width: '10rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    {
      id: 'SKU',
      label: this.text().variantSku,
      width: '11.5rem',
      kind: 'text',
      className: 'app-col-secondary',
    },
    {
      id: 'actions',
      label: this.shared().pageHeader.actions,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly sortFields = computed(() => [
    { field: 'PRODUCT_NAME', label: this.text().inventoryProduct },
    { field: 'QUANTITY', label: this.text().variantQuantity },
    { field: 'SKU', label: this.text().variantSku },
  ]);
  protected readonly filterFields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    const activity = [
      { value: 'ACTIVE', label: text.active },
      { value: 'INACTIVE', label: text.variantInactive },
    ];
    return [
      {
        key: 'inventoryTracked',
        label: text.inventoryTracking,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
      {
        key: 'stockStatus',
        label: text.inventoryAvailability,
        type: 'enum',
        operators: ['equals'],
        options: [
          { value: 'IN_STOCK', label: text.inventoryInStock },
          { value: 'OUT_OF_STOCK', label: text.inventoryOutOfStock },
        ],
      },
      {
        key: 'productActive',
        label: text.inventoryProductStatus,
        type: 'enum',
        operators: ['equals'],
        options: activity,
      },
      {
        key: 'variantActive',
        label: text.variantStatus,
        type: 'enum',
        operators: ['equals'],
        options: activity,
      },
      {
        key: 'brandId',
        label: text.brand,
        type: 'enum',
        operators: ['equals'],
        options: (this.brandOptions.hasValue() ? this.brandOptions.value() : []).map(
          ({ id, name }) => ({ value: id, label: name }),
        ),
      },
      {
        key: 'categoryId',
        label: text.category,
        type: 'enum',
        operators: ['equals'],
        options: categoryRows(
          this.categoryOptions.hasValue() ? this.categoryOptions.value() : [],
        ).map(({ id, path }) => ({ value: id, label: path })),
      },
      {
        key: 'barcode',
        label: text.variantBarcode,
        type: 'text',
        operators: ['equals'],
        maxLength: 255,
      },
      ...this.characteristicFields(),
      ...(this.unknownChoices().length
        ? [
            {
              key: 'characteristicChoiceIds',
              label: text.characteristics,
              type: 'enum' as const,
              operators: ['isAnyOf' as const],
            },
          ]
        : []),
    ];
  });
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const {
      inventoryTracked,
      stockStatus,
      productActive,
      variantActive,
      brandId,
      categoryId,
      barcode,
      characteristicChoiceIds,
    } = this.url.state().filter;
    const conditions: FilterCondition[] = [];
    if (inventoryTracked !== undefined) {
      conditions.push({
        id: 'inventoryTracked',
        field: 'inventoryTracked',
        operator: inventoryTracked ? 'isTrue' : 'isFalse',
        values: [],
      });
    }
    const choices = new Set(characteristicChoiceIds);
    return [
      ...conditions,
      ...valueCondition('stockStatus', stockStatus && stockStatus !== 'ALL' ? [stockStatus] : []),
      ...valueCondition('productActive', activeValues(productActive)),
      ...valueCondition('variantActive', activeValues(variantActive)),
      ...valueCondition('brandId', brandId),
      ...valueCondition('categoryId', categoryId),
      ...valueCondition('barcode', barcode ? [barcode] : []),
      ...this.characteristicFields().flatMap(({ key, options }) =>
        valueCondition(
          key,
          options.map(({ value }) => value).filter((id) => choices.has(id)),
          'isAnyOf',
        ),
      ),
      ...valueCondition('characteristicChoiceIds', this.unknownChoices(), 'isAnyOf'),
    ];
  });
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort, filter } = this.url.state();
    const {
      inventoryTracked,
      productActive,
      variantActive,
      brandId,
      categoryId,
      barcode,
      stockStatus,
      characteristicChoiceIds,
    } = filter;
    const inventoryFilter: InventoryFilter = {
      inventoryTracked,
      productActive,
      variantActive,
      brandId: brandId?.[0],
      categoryId: categoryId?.[0],
      barcode,
      stockStatus: stockStatus === 'ALL' ? undefined : stockStatus,
      characteristicChoiceIds: characteristicChoiceIds ? [...characteristicChoiceIds] : undefined,
    };
    return scope
      ? {
          scope,
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            sort,
            filter: inventoryFilter,
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

  protected quantity(value: number | null): string {
    return formatNumber(value, this.language.value());
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    const current = this.conditions();
    // A newly applied condition replaces the previous condition for its field.
    const applied = conditions.find(
      (next) =>
        !current.some(
          ({ id, field, operator, values }) =>
            id === next.id &&
            field === next.field &&
            operator === next.operator &&
            values.length === next.values.length &&
            values.every((value, index) => value === next.values[index]),
        ),
    );
    const byField = new Map(conditions.map((condition) => [condition.field, condition]));
    if (applied) {
      byField.set(applied.field, applied);
    }
    const tracked = byField.get('inventoryTracked');
    const stockStatus = stockStatuses.find(
      (status) => status === byField.get('stockStatus')?.values[0],
    );
    const choiceIds = [...byField.values()]
      .filter(
        ({ field }) => field.startsWith('characteristic-') || field === 'characteristicChoiceIds',
      )
      .flatMap(({ values }) => values);
    this.url.patchFilter({
      inventoryTracked: tracked && tracked.operator === 'isTrue',
      brandId: byField.get('brandId')?.values,
      categoryId: byField.get('categoryId')?.values,
      productActive: activeFilter(byField.get('productActive')?.values[0]),
      variantActive: activeFilter(byField.get('variantActive')?.values[0]),
      stockStatus,
      barcode: byField.get('barcode')?.values[0],
      characteristicChoiceIds: choiceIds.length ? choiceIds : undefined,
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
