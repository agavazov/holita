import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
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
  tableView,
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
        [title]="editing() ? text().edit : text().createProduct"
        [closeLink]="null"
        [saving]="saving()"
        [dirty]="form.dirty"
        (closeRequest)="drawer.set(false)"
      >
        <form [formGroup]="form" (ngSubmit)="save()" class="app-form-section">
          <osnova-form-field controlId="product-name" [label]="text().name" [required]="true"
            ><input pInputText id="product-name" formControlName="name"
          /></osnova-form-field>
          <osnova-form-field controlId="product-price" [label]="text().price" [required]="true"
            ><input pInputText id="product-price" inputmode="decimal" formControlName="price"
          /></osnova-form-field>
          <osnova-form-field controlId="product-status" [label]="text().status" [required]="true"
            ><p-select
              inputId="product-status"
              formControlName="status"
              [options]="statusOptions()"
              optionLabel="label"
              optionValue="value"
          /></osnova-form-field>
          @if (error(); as message) {
            <p-message severity="error">{{ message }}</p-message>
          }
          <button pButton type="submit" [disabled]="saving()">{{ text().save }}</button>
        </form>
      </osnova-route-drawer>
    }
  `,
})
export class ProductsPage {
  readonly language = inject(OperatorLanguage);
  readonly session = inject(DemoSession);
  private readonly api = inject(OperatorApi);
  readonly page = signal<OperatorProductsQuery['products'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly drawer = signal(false);
  readonly editing = signal<Product | null>(null);
  readonly saving = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);
  readonly appliedSearch = signal('');
  readonly conditions = signal<readonly FilterCondition[]>([]);
  readonly sort = signal<NonNullable<ListQuery['sort']>>({ field: 'NAME', direction: 'asc' });
  readonly text = computed(() => strings[this.language.value()]);
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
  });
  constructor() {
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
    });
    this.error.set(null);
    this.drawer.set(true);
  }
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const branch = this.session.branchId();
    if (this.form.invalid || !branch) {
      return;
    }
    this.saving.set(true);
    try {
      await this.api.saveProduct(
        this.language.value(),
        branch,
        this.form.getRawValue(),
        this.editing()?.id,
      );
      this.drawer.set(false);
      await this.load();
    } catch (error: unknown) {
      this.error.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
}
