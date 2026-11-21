import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import {
  FilterBuilder,
  ListSortMenu,
  FormField,
  PageHeader,
  RouteDrawer,
  TablePanel,
  fieldErrors,
  lockWhileSaving,
  tableView,
  uiMessages,
  type FilterCondition,
  type FilterField,
  type ListQuery,
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

type Product = OperatorProductsQuery['products']['items'][number];

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
    ReactiveFormsModule,
    InputText,
    Select,
    FormField,
    Message,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header [title]="text().products" [actions]="actions()" (action)="open()" />
    @if (!session.branchId()) {
      <p-message severity="info">{{ text().noShop }}</p-message>
    }
    <osnova-table-panel
      [heading]="text().products"
      [view]="view()"
      [total]="page()?.total ?? null"
      [errorText]="error()"
      [page]="pagination()"
      (pageChange)="changePage($event)"
      (retry)="load()"
    >
      <osnova-filter-builder
        panelActions
        [searchLabel]="text().search"
        [search]="appliedSearch()"
        [fields]="filterFields()"
        [conditions]="conditions()"
        [maxConditions]="1"
        (searchChange)="changeSearch($event)"
        (conditionsChange)="changeConditions($event)"
      >
        <osnova-list-sort-menu
          filterActions
          [fields]="sortFields()"
          [sort]="sort()"
          (sortChange)="changeSort($event)"
        />
      </osnova-filter-builder>
      <p-table [value]="page()?.items ?? []"
        ><ng-template #header
          ><tr>
            <th>{{ text().name }}</th>
            <th>{{ text().price }}</th>
            <th>{{ text().status }}</th>
            @if (canWrite()) {
              <th></th>
            }</tr></ng-template
        ><ng-template #body let-row
          ><tr>
            <td>{{ row.name }}</td>
            <td>{{ row.price }}</td>
            <td>{{ statusLabel(row.status) }}</td>
            @if (canWrite()) {
              <td>
                <button pButton type="button" severity="secondary" (click)="open(row)">
                  {{ text().edit }}
                </button>
              </td>
            }
          </tr></ng-template
        ></p-table
      >
    </osnova-table-panel>
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
  readonly page = signal<OperatorProductsQuery['products'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly drawer = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly brandError = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);
  readonly appliedSearch = signal('');
  readonly conditions = signal<readonly FilterCondition[]>([]);
  readonly sort = signal<NonNullable<ListQuery['sort']>>({ field: 'NAME', direction: 'asc' });
  readonly text = computed(() => strings[this.language.value()]);
  readonly shared = computed(() => uiMessages[this.language.value()]);
  readonly brandOptions = resource({
    params: () => (this.drawer() ? (this.brands.scope() ?? undefined) : undefined),
    loader: ({ params, abortSignal }) => this.brands.options(params, abortSignal),
  });
  readonly options = computed(() => [
    { id: null, name: this.text().noBrand },
    ...(this.brandOptions.hasValue() ? this.brandOptions.value() : []),
  ]);
  readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.session.branchId());
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().createProduct, primary: true }] : [],
  );
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page()?.items.length ?? null,
      filtered: this.appliedSearch().length > 0 || this.conditions().length > 0,
    }),
  );
  readonly pagination = computed(() => ({
    page: this.currentPage(),
    pageSize: this.pageSize(),
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
  });
  constructor() {
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {},
    );
    effect(() => {
      this.brands.scope();
      this.drawer.set(false);
    });
    effect(() => {
      this.language.value();
      this.session.branchId();
      this.currentPage();
      this.pageSize();
      this.appliedSearch();
      this.conditions();
      this.sort();
      untracked(() => {
        void this.load();
      });
    });
  }
  async load(): Promise<void> {
    const branch = this.session.branchId();
    if (!branch) {
      this.page.set(null);
      this.loading.set(false);
      return;
    }
    const token = this.session.current()?.token;
    this.loading.set(true);
    try {
      const result = await this.api.products(
        this.language.value(),
        branch,
        (this.currentPage() - 1) * this.pageSize(),
        this.pageSize(),
        this.appliedSearch(),
        {
          field:
            this.sort().field === 'PRICE'
              ? 'PRICE'
              : this.sort().field === 'STATUS'
                ? 'STATUS'
                : 'NAME',
          direction: this.sort().direction === 'desc' ? 'DESC' : 'ASC',
        },
        this.conditions().length
          ? {
              statuses:
                this.conditions()[0]?.values.filter(
                  (value): value is ProductStatus =>
                    value === 'DRAFT' || value === 'ACTIVE' || value === 'ARCHIVED',
                ) ?? [],
            }
          : null,
      );
      if (this.session.branchId() === branch && this.session.current()?.token === token) {
        this.page.set(result);
        this.error.set(null);
      }
    } catch (error: unknown) {
      if (this.session.branchId() === branch) {
        this.error.set(requestError(error, this.text().unavailable));
      }
    } finally {
      if (this.session.branchId() === branch) {
        this.loading.set(false);
      }
    }
  }
  changeSearch(value: string): void {
    this.currentPage.set(1);
    this.appliedSearch.set(value);
  }
  changeConditions(value: readonly FilterCondition[]): void {
    this.currentPage.set(1);
    this.conditions.set(value);
  }
  changeSort(value: NonNullable<ListQuery['sort']>): void {
    this.currentPage.set(1);
    this.sort.set(value);
  }
  changePage(value: { page: number; pageSize: number }): void {
    this.pageSize.set(value.pageSize);
    this.currentPage.set(value.page);
  }
  open(row?: Product): void {
    this.editing.set(row ?? null);
    this.form.reset({
      name: row?.name ?? '',
      price: row?.price ?? '',
      status: row?.status ?? 'DRAFT',
      brandId: row?.brandId ?? null,
    });
    this.saveError.set(null);
    this.brandError.set(null);
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
    try {
      await this.api.saveProduct(
        this.language.value(),
        branch,
        this.form.getRawValue(),
        this.editing()?.id,
      );
      if (this.brands.scope() === scope) {
        this.drawer.set(false);
        await this.load();
      }
    } catch (error: unknown) {
      if (this.brands.scope() === scope) {
        const errors = fieldErrors(error, ['brandId'], this.language.value());
        this.brandError.set(errors.brandId ?? null);
        this.saveError.set(errors.brandId ? null : this.text().unavailable);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
