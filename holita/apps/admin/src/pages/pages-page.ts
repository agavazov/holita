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
  below,
  codecs,
  formatDateTimeCell,
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
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  OperatorShopPageListFieldsFragment,
  OperatorShopPagesQuery,
  ShopPageSortField,
  ShopPageStatus,
} from '../generated/pages-operations';
import { PagesApi } from './pages-api';
import { pagePath, pageTitle } from './page-labels';

type PageList = OperatorShopPagesQuery['shopPages'];
type PageRow = OperatorShopPageListFieldsFragment;
const statuses = ['DRAFT', 'PUBLISHED'] as const;
const statusCodec = codecs.enumList(statuses);
const definition: ListDefinition<
  { statuses: readonly ShopPageStatus[] | undefined },
  ShopPageSortField
> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'updatedAt', field: 'UPDATED_AT' },
    { param: 'slug', field: 'SLUG' },
    { param: 'status', field: 'STATUS' },
  ],
  defaultSort: { field: 'UPDATED_AT', direction: 'DESC' },
  filters: { statuses: statusCodec },
};

@Component({
  selector: 'holita-pages-page',
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
  templateUrl: './pages-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagesPage {
  private readonly api = inject(PagesApi);
  private readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly sortReady = injectSortReady();
  protected readonly scope = this.api.scope;
  protected readonly narrow = below('md');
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly canWrite = computed(() => !!this.scope() && this.session.hasRole('OPERATOR'));
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly tableMinWidth = '25rem';
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().newPage, primary: true }] : [],
  );
  protected readonly actions = computed<readonly ListAction<'edit', PageRow>[]>(() =>
    this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : [],
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'page',
      label: this.text().pageTitle,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'STATUS', label: this.text().status, width: '7.5rem', kind: 'status' },
    {
      id: 'UPDATED_AT',
      label: this.text().pageUpdatedAt,
      width: '11rem',
      kind: 'date',
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
  protected readonly sortFields = computed(() => [
    { field: 'UPDATED_AT', label: this.text().pageUpdatedAt },
    { field: 'SLUG', label: this.text().slug },
    { field: 'STATUS', label: this.text().status },
  ]);
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'status',
      label: this.text().status,
      type: 'enum',
      operators: ['isAnyOf'],
      options: statuses.map((value) => ({ value, label: this.statusLabel(value) })),
    },
  ]);
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const active = this.url.state().filter.statuses;
    return active ? [{ id: 'status', field: 'status', operator: 'isAnyOf', values: active }] : [];
  });
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search, sort, filter } = this.url.state();
    return scope
      ? {
          scope,
          provisionPolicies: this.canWrite(),
          variables: {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            search,
            sort,
            filter: filter.statuses ? { statuses: [...filter.statuses] } : null,
          },
        }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.list(params.scope, params.variables, params.provisionPolicies),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<PagesApi['scope']>; data: PageList | undefined },
    PageList | null
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

  protected title(page: PageRow): string {
    return pageTitle(page, this.language.value());
  }

  protected path(page: PageRow): string | null {
    return pagePath(this.scope()?.branchId, page);
  }

  protected statusLabel(status: ShopPageStatus): string {
    return status === 'PUBLISHED' ? this.text().pagePublished : this.text().draft;
  }

  protected updatedAt(value: string) {
    return formatDateTimeCell(value, this.language.value(), 'UTC');
  }

  protected record(page: PageRow) {
    return listRecord(this.actions(), page, page.id, this.title(page));
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    this.url.patchFilter({ statuses: statusCodec.read(conditions[0]?.values ?? []) });
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

  protected open(id: string): void {
    if (this.canWrite()) {
      void this.router.navigate([id], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    }
  }

  protected run(request: ListActionRequest<'edit'>): void {
    const id = request.ids[0];
    if (id) {
      this.open(id);
    }
  }
}
