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
import type {
  OperatorCollectionSummaryFragment,
  ProductCollectionMode,
  ProductCollectionSortField,
} from '../generated/collections-operations';
import { CollectionsApi } from './collections-api';

type CollectionAction = 'edit';
type CollectionListPage = Awaited<ReturnType<CollectionsApi['list']>>;
const definition: ListDefinition<Record<string, never>, ProductCollectionSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'NAME' },
    { param: 'slug', field: 'SLUG' },
    { param: 'status', field: 'ACTIVE' },
  ],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-collections-page',
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
  templateUrl: './collections-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsPage {
  private readonly api = inject(CollectionsApi);
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
  protected readonly tableMinWidth = '20rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().newCollection, primary: true }] : [],
  );
  protected readonly actions = computed<
    readonly ListAction<CollectionAction, OperatorCollectionSummaryFragment>[]
  >(() => (this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : []));
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'NAME',
      label: this.text().name,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'ACTIVE', label: this.text().status, width: '7.5rem', kind: 'status' },
    {
      id: 'mode',
      label: this.text().collectionMode,
      width: '10rem',
      kind: 'text',
      className: 'app-col-secondary',
    },
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
  private readonly modeLabels = computed<Record<ProductCollectionMode, string>>(() => ({
    MANUAL: this.text().collectionManual,
    CATEGORY: this.text().collectionByCategory,
    BRAND: this.text().collectionByBrand,
  }));
  protected readonly sortFields = computed(() => [
    { field: 'NAME', label: this.text().name },
    { field: 'SLUG', label: this.text().slug },
    { field: 'ACTIVE', label: this.text().status },
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
    { scope: ReturnType<CollectionsApi['scope']>; data: CollectionListPage | undefined },
    CollectionListPage | null
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

  protected record(collection: OperatorCollectionSummaryFragment) {
    return listRecord(this.actions(), collection, collection.id, collection.name);
  }

  protected modeLabel(mode: ProductCollectionMode): string {
    return this.modeLabels()[mode];
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

  protected run(request: ListActionRequest<CollectionAction>): void {
    const id = request.ids[0];
    if (id && this.canWrite()) {
      this.open(id);
    }
  }
}
