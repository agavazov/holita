import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  convertToParamMap,
  type ParamMap,
} from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import type {
  AdminProductFragment,
  AdminProductsQuery,
  AdminStoresQuery,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, type Language } from '../../i18n/messages';
import { ProductsApi } from './products-api';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  productListQueryParams,
  productListVariables,
  productPageSizes,
  readProductListQuery,
  sameProductListQuery,
  type ProductListQuery,
} from './product-list-query';

@Component({
  selector: 'holita-products-page',
  providers: [ProductsApi, ConfirmationService],
  imports: [
    FormsModule,
    RouterLink,
    ButtonDirective,
    TableModule,
    Message,
    InputText,
    Select,
    Paginator,
    ConfirmDialog,
  ],
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly api = inject(ProductsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly saved =
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.extras.state?.[
      'productSaved'
    ] === true;
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('productsHeading');
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly listQuery = computed(() => readProductListQuery(this.params()));
  readonly selected = linkedSignal<ProductListQuery, AdminProductFragment[]>({
    source: this.listQuery,
    computation: (query, previous) =>
      previous && sameProductListQuery(query, previous.source) ? previous.value : [],
  });
  readonly deleteProgress = signal<{ completed: number; total: number } | null>(null);
  readonly deleting = computed(() => this.deleteProgress() !== null);
  readonly deletionResult = signal<{
    deleted: number;
    failures: { product: AdminProductFragment; message: string }[];
  } | null>(null);
  readonly deletingMessage = computed(() => {
    const progress = this.deleteProgress();
    return progress
      ? this.text()
          .deletingProducts.replace('{completed}', String(progress.completed))
          .replace('{total}', String(progress.total))
      : '';
  });
  readonly deletionSummary = computed(() => {
    const result = this.deletionResult();
    if (!result) return '';
    return (
      this.text().productsDeleted.replace('{count}', String(result.deleted)) +
      (result.failures.length
        ? ' ' + this.text().productsDeleteFailed.replace('{count}', String(result.failures.length))
        : '')
    );
  });
  readonly search = linkedSignal(() => this.listQuery().search);
  readonly sku = linkedSignal(() => this.listQuery().sku);
  readonly pageSizes = productPageSizes;
  readonly statusOptions = computed(() => [
    { label: this.text().allStatuses, value: null },
    { label: this.text().active, value: 'ACTIVE' },
    { label: this.text().draft, value: 'DRAFT' },
  ]);
  readonly sortField = computed(() =>
    this.listQuery().sort === 'CREATED_AT' ? 'createdAt' : this.listQuery().sort.toLowerCase(),
  );
  readonly sortOrder = computed(() => (this.listQuery().order === 'ASC' ? 1 : -1));
  private readonly textEdits = new Subject<void>();
  private readonly cancelEdits = new Subject<void>();
  private readonly sortEdits = new Subject<Pick<ProductListQuery, 'sort' | 'order'>>();
  private query: ReturnType<ProductsApi['watch']> | undefined;
  readonly page = signal<AdminProductsQuery['products'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly trackProduct = (_index: number, product: AdminProductFragment) => product.id;

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.textEdits
      .pipe(
        switchMap(() => timer(300).pipe(takeUntil(this.cancelEdits))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.applyFilters({}, true);
      });
    // Table also emits when controlled sort inputs change; coalesce those updates before comparing the URL.
    this.sortEdits
      .pipe(
        switchMap((sort) =>
          timer(0).pipe(
            takeUntil(this.cancelEdits),
            map(() => sort),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((sort) => {
        const current = this.listQuery();
        if (sort.sort !== current.sort || sort.order !== current.order) this.applyFilters(sort);
      });
    this.route.queryParamMap
      .pipe(
        tap((params) => {
          this.cancelEdits.next();
          this.normalizeUrl(params);
        }),
        map(readProductListQuery),
        distinctUntilChanged(sameProductListQuery),
        switchMap((params) => {
          this.confirmation.close();
          this.deleteProgress.set(null);
          this.page.set(null);
          this.error.set(null);
          this.loading.set(true);
          const query = this.api.watch(productListVariables(params));
          this.query = query;
          return query.valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (
          result.dataState === 'complete' &&
          !result.error &&
          !(this.deleting() && result.loading)
        ) {
          const products = result.data.products;
          const current = this.listQuery();
          const lastPage = Math.max(1, Math.ceil(products.total / current.pageSize));
          if (current.page > lastPage) {
            // Cached totals may be stale; wait for a successful network result before correcting the URL.
            if (!result.loading) this.navigate({ ...current, page: lastPage }, true);
          } else {
            this.page.set(products);
            const selectedIds = new Set(this.selected().map((product) => product.id));
            this.selected.set(products.items.filter((product) => selectedIds.has(product.id)));
          }
        }
      });
  }

  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed && this.query === query) this.error.set(error);
    });
  }

  selectProducts(value: unknown): void {
    if (this.deleting() || !Array.isArray(value)) return;
    const ids = new Set(
      value.flatMap((product: unknown) =>
        typeof product === 'object' &&
        product !== null &&
        'id' in product &&
        typeof product.id === 'string'
          ? [product.id]
          : [],
      ),
    );
    this.selected.set(this.page()?.items.filter((product) => ids.has(product.id)) ?? []);
  }

  confirmDelete(products: readonly AdminProductFragment[], event: Event): void {
    const query = this.query;
    if (this.deleting() || !query || products.length === 0) return;
    const targets = [...products];
    const text = this.text();
    const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.confirmation.confirm({
      ...(trigger ? { target: trigger } : {}),
      header: text.deleteProductsTitle,
      message:
        targets.length === 1
          ? text.deleteProductDescription.replace('{name}', targets[0]?.name ?? '')
          : text.deleteProductsDescription.replace('{count}', String(targets.length)),
      rejectButtonProps: { label: text.cancel, severity: 'secondary', outlined: true },
      acceptButtonProps: { label: text.deleteProducts, severity: 'danger' },
      accept: () => {
        if (!this.isCurrentQuery(query)) return;
        this.heading().nativeElement.focus();
        void this.deleteProducts(targets, query);
      },
      reject: () => {
        if (this.isCurrentQuery(query)) trigger?.focus();
      },
    });
  }

  private async deleteProducts(
    targets: readonly AdminProductFragment[],
    query: ReturnType<ProductsApi['watch']>,
  ): Promise<void> {
    if (!this.isCurrentQuery(query) || this.deleting()) return;
    this.cancelEdits.next();
    this.deletionResult.set(null);
    this.deleteProgress.set({ completed: 0, total: targets.length });
    let deleted = 0;
    const failures: { product: AdminProductFragment; message: string }[] = [];
    try {
      for (const product of targets) {
        // Navigation retires this query: let the submitted write settle, but do not send the remainder.
        if (!this.isCurrentQuery(query)) return;
        try {
          await this.api.delete({ id: product.id });
          deleted++;
          if (!this.isCurrentQuery(query)) return;
          this.page.update(
            (page) =>
              page && {
                ...page,
                items: page.items.filter((item) => item.id !== product.id),
              },
          );
        } catch (error: unknown) {
          if (!this.isCurrentQuery(query)) return;
          failures.push({ product, message: requestError(error, this.text().networkError) });
        }
        this.deleteProgress.set({ completed: deleted + failures.length, total: targets.length });
      }
      this.selected.set(failures.map((failure) => failure.product));
      this.deletionResult.set({ deleted, failures });
      // The server owns totals and last-page correction, including concurrent changes.
      await query.refetch();
    } catch (error: unknown) {
      if (this.isCurrentQuery(query)) this.error.set(error);
    } finally {
      if (this.isCurrentQuery(query)) this.deleteProgress.set(null);
    }
  }

  private isCurrentQuery(query: ReturnType<ProductsApi['watch']>): boolean {
    return !this.destroyRef.destroyed && this.query === query;
  }

  editText(field: 'search' | 'sku', value: unknown): void {
    if (typeof value !== 'string') return;
    this[field].set(value);
    this.textEdits.next();
  }

  changeStatus(value: unknown): void {
    if (value === null || value === 'ACTIVE' || value === 'DRAFT')
      this.applyFilters({ status: value });
  }

  sortChanged(event: unknown): void {
    if (typeof event !== 'object' || event === null || !('field' in event) || !('order' in event))
      return;
    const field = event.field;
    if (
      (field !== 'name' && field !== 'sku' && field !== 'status') ||
      (event.order !== 1 && event.order !== -1)
    )
      return;
    this.sortEdits.next({
      sort: field === 'name' ? 'NAME' : field === 'sku' ? 'SKU' : 'STATUS',
      order: event.order === 1 ? 'ASC' : 'DESC',
    });
  }

  resetSort(): void {
    this.applyFilters({ sort: 'CREATED_AT', order: 'DESC' });
  }

  clearFilters(): void {
    this.applyFilters({ search: '', sku: '', status: null });
  }

  changePage(event: PaginatorState): void {
    const current = this.listQuery();
    const size = event.rows ?? current.pageSize;
    if (!productPageSizes.includes(size)) return;
    this.navigate({
      ...current,
      pageSize: size,
      page: size === current.pageSize ? (event.page ?? 0) + 1 : 1,
    });
  }

  private applyFilters(changes: Partial<ProductListQuery>, replaceUrl = false): void {
    this.cancelEdits.next();
    this.navigate(
      { ...this.listQuery(), page: 1, search: this.search(), sku: this.sku(), ...changes },
      replaceUrl,
    );
  }

  private navigate(query: ProductListQuery, replaceUrl = false): void {
    const normalized = readProductListQuery(convertToParamMap(productListQueryParams(query)));
    // Angular skips unchanged URLs, so reset drafts even when no route event will follow.
    this.search.set(normalized.search);
    this.sku.set(normalized.sku);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: productListQueryParams(normalized),
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl,
    });
  }

  private normalizeUrl(params: ParamMap): void {
    const query = readProductListQuery(params);
    const expected = productListQueryParams(query);
    if (
      Object.entries(expected).some(
        ([key, value]) =>
          params.get(key) !== value || params.getAll(key).length > (value === null ? 0 : 1),
      )
    )
      this.navigate(query, true);
  }
}
