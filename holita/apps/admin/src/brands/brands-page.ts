import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
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
  injectSortReady,
  listQuery,
  listRecord,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type ListQuery,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { BrandSortField, OperatorBrandFieldsFragment } from '../generated/brands-operations';
import { BrandsApi } from './brands-api';

type BrandAction = 'edit' | 'delete';
type BrandListPage = Awaited<ReturnType<BrandsApi['list']>>;
const definition: ListDefinition<Record<string, never>, BrandSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'NAME' },
    { param: 'slug', field: 'SLUG' },
    { param: 'status', field: 'STATUS' },
  ],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-brands-page',
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
  templateUrl: './brands-page.html',
  styleUrl: './brands-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandsPage {
  private readonly api = inject(BrandsApi);
  private readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sortReady = injectSortReady();
  private readonly deleting = signal(false);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly tableMinWidth = '20rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite()
      ? [{ id: 'create', label: this.text().newBrand, primary: true, disabled: this.deleting() }]
      : [],
  );
  protected readonly actions = computed<
    readonly ListAction<BrandAction, OperatorBrandFieldsFragment>[]
  >(() =>
    this.canWrite()
      ? [
          { id: 'edit', label: this.text().edit, appliesTo: () => !this.deleting() },
          {
            id: 'delete',
            label: this.text().delete,
            danger: true,
            appliesTo: () => !this.deleting(),
            confirm: {
              title: this.text().deleteBrand,
              detail: this.text().deleteBrandDetail,
              accept: this.text().delete,
            },
          },
        ]
      : [],
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'NAME',
      label: this.text().name,
      width: '67%',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'STATUS', label: this.text().status, width: '33%', kind: 'status' },
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
    { field: 'NAME', label: this.text().name },
    { field: 'SLUG', label: this.text().slug },
    { field: 'STATUS', label: this.text().status },
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
    { scope: ReturnType<BrandsApi['scope']>; data: BrandListPage | undefined },
    BrandListPage | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous && previous.source.scope === current.scope ? previous.value : null),
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

  protected record(brand: OperatorBrandFieldsFragment) {
    return listRecord(this.actions(), brand, brand.id, brand.name);
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

  protected open(id: string): void {
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  protected async run(request: ListActionRequest<BrandAction>): Promise<void> {
    const id = request.ids[0];
    const scope = this.scope();
    if (!id || !scope || !this.canWrite() || this.deleting()) {
      return;
    }
    if (request.action === 'edit') {
      this.open(id);
      return;
    }
    this.deleting.set(true);
    try {
      await this.api.delete(scope, id);
      if (!this.destroyRef.destroyed && this.scope() === scope) {
        this.messages.add({ severity: 'success', summary: this.text().brandDeleted });
        this.list.reload();
      }
    } catch {
      if (!this.destroyRef.destroyed && this.scope() === scope) {
        this.messages.add({
          severity: 'error',
          summary: this.text().brandDeleteFailed,
          sticky: true,
        });
      }
    } finally {
      this.deleting.set(false);
    }
  }
}
