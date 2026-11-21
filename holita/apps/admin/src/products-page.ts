import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  FilterBuilder,
  ListSortMenu,
  FormField,
  PageHeader,
  RouteDrawer,
  RowActions,
  TablePanel,
  UrlListState,
  codecs,
  fieldErrors,
  injectSortReady,
  listQuery,
  listRecord,
  lockWhileSaving,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
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
import {
  OperatorApi,
  OperatorLanguage,
  operatorStrings as strings,
  type OperatorProductsQuery,
  type ProductStatus,
} from '@holita/operator';
import { BrandsApi } from './brands/brands-api';
import { CategoriesApi } from './categories/categories-api';
import { categoryOptions } from './categories/category-tree';

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
    ButtonDirective,
    RouteDrawer,
    RowActions,
    Tag,
    ReactiveFormsModule,
    InputText,
    Select,
    FormField,
    Message,
  ],
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header
      [title]="text().products"
      [moduleInfo]="text().productsInfo"
      [actions]="actions()"
      (action)="open()"
    />
    @if (scope()) {
      <osnova-table-panel
        #panel
        [heading]="text().shopProducts"
        [columns]="columns()"
        [tableMinWidth]="'25rem'"
        [view]="view()"
        [total]="page()?.total ?? null"
        [busy]="list.isLoading()"
        [errorText]="error()"
        [emptyTitle]="text().emptyProducts"
        [page]="pagination()"
        [actionContext]="params()"
        [actions]="rowActions()"
        (action)="run($event)"
        (pageChange)="url.setPage($event)"
        (retry)="list.reload()"
        (clearFilters)="url.clearFilters()"
      >
        <osnova-filter-builder
          panelActions
          [searchLabel]="text().searchProducts"
          [search]="url.searchDraft()"
          [searchError]="url.searchError() ? shared().searchTooManyWords : null"
          [fields]="filterFields()"
          [conditions]="conditions()"
          [maxConditions]="1"
          (searchChange)="url.editSearch($event)"
          (conditionsChange)="changeConditions($event)"
        >
          <osnova-list-sort-menu
            filterActions
            [fields]="sortFields()"
            [sort]="sort()"
            (sortChange)="changeSort($event)"
          />
        </osnova-filter-builder>
        <p-table
          class="app-responsive-table app-table-fixed"
          [value]="page()?.items ?? []"
          [rowTrackBy]="trackById"
          [lazy]="true"
          [lazyLoadOnInit]="false"
          [scrollable]="true"
          [tableStyle]="{ 'min-width': 'var(--app-table-responsive-min-width)' }"
          [sortField]="sort().field"
          [sortOrder]="sort().direction === 'asc' ? 1 : -1"
          (onLazyLoad)="tableSort($event)"
          dataKey="id"
        >
          <ng-template #colgroup>
            <colgroup>
              @for (column of columns(); track column.id) {
                <col
                  [class]="column.className ?? ''"
                  [style.width]="
                    column.kind === 'identity'
                      ? 'var(--app-table-identity-width, ' + column.width + ')'
                      : column.width
                  "
                />
              }
            </colgroup>
          </ng-template>
          <ng-template #header>
            <tr>
              <th scope="col" class="app-col-identity" pSortableColumn="NAME">
                {{ text().name }} <p-sort-icon field="NAME" />
              </th>
              <th scope="col" class="app-cell-number" pSortableColumn="PRICE">
                {{ text().price }} <p-sort-icon field="PRICE" />
              </th>
              <th scope="col" pSortableColumn="STATUS">
                {{ text().status }} <p-sort-icon field="STATUS" />
              </th>
              @if (canWrite()) {
                <th scope="col" class="app-col-actions" pFrozenColumn alignFrozen="right">
                  <span class="app-visually-hidden">{{ shared().pageHeader.actions }}</span>
                </th>
              }
            </tr>
          </ng-template>
          <ng-template #body let-product>
            @let row = record(product);
            @let amount = formatPrice(product.price);
            <tr>
              <td class="app-col-identity">
                <div class="app-cell-identity">
                  @if (canWrite()) {
                    <button
                      type="button"
                      class="app-link"
                      [title]="product.name"
                      (click)="panel.run('edit', [row], $event.currentTarget)"
                    >
                      {{ product.name }}
                    </button>
                  } @else {
                    <span [title]="product.name">{{ product.name }}</span>
                  }
                </div>
                @if (canWrite()) {
                  <div class="app-table-mobile-actions">
                    <osnova-row-actions
                      [actions]="rowActions()"
                      [record]="row"
                      (choose)="panel.run($event.action, [row], $event.origin)"
                    />
                  </div>
                }
              </td>
              <td class="app-cell-number" [title]="amount">{{ amount }}</td>
              <td>
                <div class="app-cell-status">
                  <p-tag
                    [severity]="statusTone(product.status)"
                    [value]="statusLabel(product.status)"
                  />
                </div>
              </td>
              @if (canWrite()) {
                <td class="app-col-actions" pFrozenColumn alignFrozen="right">
                  <osnova-row-actions
                    [actions]="rowActions()"
                    [record]="row"
                    (choose)="panel.run($event.action, [row], $event.origin)"
                  />
                </td>
              }
            </tr>
          </ng-template>
        </p-table>
      </osnova-table-panel>
    } @else {
      <p-message severity="info">{{ text().noShop }}</p-message>
    }
    @if (drawer()) {
      <osnova-route-drawer
        #productDrawer
        [title]="editing() ? text().editProduct : text().createProduct"
        [subtitle]="editing()?.name ?? null"
        [closeLink]="null"
        [saving]="saving()"
        [dirty]="form.dirty"
        (closeRequest)="closeDrawer(productDrawer)"
      >
        <form
          id="product-editor-form"
          [formGroup]="form"
          (ngSubmit)="save()"
          class="app-form-section"
        >
          <osnova-form-field controlId="product-name" [label]="text().name" [required]="true"
            ><input pInputText id="product-name" formControlName="name"
          /></osnova-form-field>
          <osnova-form-field controlId="product-price" [label]="text().price" [required]="true"
            ><input pInputText id="product-price" inputmode="decimal" formControlName="price"
          /></osnova-form-field>
          <osnova-form-field controlId="product-status" [label]="text().status" [required]="true"
            ><p-select
              inputId="product-status"
              ariaLabelledBy="product-status-label"
              formControlName="status"
              [options]="statusOptions()"
              optionLabel="label"
              optionValue="value"
          /></osnova-form-field>
          <osnova-form-field
            controlId="product-brand"
            [label]="text().brand"
            [error]="brandError()"
          >
            <p-select
              inputId="product-brand"
              ariaLabelledBy="product-brand-label"
              formControlName="brandId"
              [options]="options()"
              optionLabel="name"
              optionValue="id"
              [placeholder]="text().noBrand"
              [filter]="true"
              [ariaFilterLabel]="text().searchBrands"
              [filterPlaceholder]="text().searchBrands"
              [emptyFilterMessage]="shared().table.noResultsTitle"
              [loading]="brandOptions.isLoading()"
              [readonly]="!brandOptions.hasValue()"
              [invalid]="!!brandError()"
              [pt]="{
                label: {
                  'aria-describedby': 'product-brand-error',
                  'aria-invalid': brandError() ? 'true' : undefined,
                },
              }"
              (onChange)="brandError.set(null)"
            />
            @if (brandOptions.error()) {
              <p-message severity="warn" variant="simple" size="small">{{
                text().brandsUnavailable
              }}</p-message>
              <button
                pButton
                type="button"
                severity="secondary"
                [text]="true"
                [disabled]="saving()"
                (click)="brandOptions.reload()"
              >
                {{ shared().retry }}
              </button>
            }
          </osnova-form-field>
          <osnova-form-field
            controlId="product-category"
            [label]="text().category"
            [error]="categoryError()"
          >
            <p-select
              inputId="product-category"
              ariaLabelledBy="product-category-label"
              formControlName="categoryId"
              [options]="availableCategories()"
              optionLabel="name"
              optionValue="id"
              [placeholder]="text().noCategory"
              [filter]="true"
              [ariaFilterLabel]="text().searchCategories"
              [filterPlaceholder]="text().searchCategories"
              [emptyFilterMessage]="shared().table.noResultsTitle"
              [loading]="categories.isLoading()"
              [readonly]="!categories.hasValue()"
              [invalid]="!!categoryError()"
              [overlayOptions]="{ style: { width: '100%' } }"
              [pt]="{
                label: {
                  'aria-describedby': 'product-category-error',
                  'aria-invalid': categoryError() ? 'true' : undefined,
                },
                option: { style: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
              }"
              (onChange)="categoryError.set(null)"
            />
            @if (categories.error()) {
              <p-message severity="warn" variant="simple" size="small">{{
                text().categoriesUnavailable
              }}</p-message>
              <button
                pButton
                type="button"
                severity="secondary"
                [text]="true"
                [disabled]="saving()"
                (click)="categories.reload()"
              >
                {{ shared().retry }}
              </button>
            }
          </osnova-form-field>
          @if (saveError(); as message) {
            <p-message severity="error">{{ message }}</p-message>
          }
        </form>
        <div drawerFooter class="app-drawer-actions">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            [disabled]="saving()"
            (click)="productDrawer.close()"
          >
            {{ shared().cancel }}
          </button>
          <button pButton type="submit" form="product-editor-form" [disabled]="saving()">
            {{ text().save }}
          </button>
        </div>
      </osnova-route-drawer>
    }
  `,
})
export class ProductsPage {
  readonly language = inject(OperatorLanguage);
  readonly session = inject(DemoSession);
  private readonly api = inject(OperatorApi);
  private readonly brands = inject(BrandsApi);
  private readonly categoryApi = inject(CategoriesApi);
  readonly scope = this.brands.scope;
  readonly url = new UrlListState(definition, () => !!this.scope());
  readonly trackById = trackById;
  private readonly sortReady = injectSortReady();
  readonly drawer = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly brandError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);
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
      this.api.products(
        scope.language,
        scope.branchId,
        (page - 1) * pageSize,
        pageSize,
        search,
        sort,
        filter.statuses ? { statuses: [...filter.statuses] } : null,
      ),
  });
  readonly page = linkedSignal<
    { scope: ReturnType<BrandsApi['scope']>; data: ProductPage | undefined },
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
  readonly brandOptions = resource({
    params: () => (this.drawer() ? (this.brands.scope() ?? undefined) : undefined),
    loader: ({ params, abortSignal }) => this.brands.options(params, abortSignal),
  });
  readonly options = computed(() => [
    { id: null, name: this.text().noBrand },
    ...(this.brandOptions.hasValue() ? this.brandOptions.value() : []),
  ]);
  readonly categories = resource({
    params: () => (this.drawer() ? (this.categoryApi.scope() ?? undefined) : undefined),
    loader: ({ params }) => this.categoryApi.list(params),
  });
  readonly availableCategories = computed(() =>
    categoryOptions(
      this.categories.hasValue() ? this.categories.value() : [],
      this.text().noCategory,
    ),
  );
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
  formatPrice(value: string): string {
    return this.price().format(Number(value));
  }
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control), Validators.maxLength(200)],
    }),
    price: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.pattern(/^\d{1,10}(?:\.\d{1,2})?$/),
      ],
    }),
    status: new FormControl<ProductStatus>('DRAFT', { nonNullable: true }),
    brandId: new FormControl<string | null>(null),
    categoryId: new FormControl<string | null>(null),
  });
  constructor() {
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {},
    );
    effect(() => {
      this.scope();
      this.drawer.set(false);
    });
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
      this.open(row);
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
  open(row?: Product): void {
    this.editing.set(row ?? null);
    this.form.reset({
      name: row?.name ?? '',
      price: row?.price ?? '',
      status: row?.status ?? 'DRAFT',
      brandId: row?.brandId ?? null,
      categoryId: row?.categoryId ?? null,
    });
    this.saveError.set(null);
    this.brandError.set(null);
    this.categoryError.set(null);
    this.drawer.set(true);
  }
  async closeDrawer(editor: RouteDrawer): Promise<void> {
    if (!this.saving() && (await editor.confirmLeave(this.form.dirty))) {
      this.drawer.set(false);
    }
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const branch = this.session.branchId();
    const scope = this.brands.scope();
    if (this.form.invalid || !branch || this.saving() || !scope) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.brandError.set(null);
    this.categoryError.set(null);
    try {
      await this.api.saveProduct(
        this.language.value(),
        branch,
        this.form.getRawValue(),
        this.editing()?.id,
      );
      if (this.brands.scope() === scope) {
        this.drawer.set(false);
        this.list.reload();
      }
    } catch (error: unknown) {
      if (this.brands.scope() === scope) {
        const errors = fieldErrors(
          error,
          ['brandId', 'categoryId'],
          scope.language,
          (code, field) =>
            field === 'categoryId' && code === 'INVALID_VALUE'
              ? this.text().categoryUnavailable
              : undefined,
        );
        this.brandError.set(errors.brandId ?? null);
        this.categoryError.set(errors.categoryId ?? null);
        this.saveError.set(Object.keys(errors).length ? null : this.text().unavailable);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
