import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  ListSortMenu,
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  codecs,
  injectDisplayFormat,
  injectSortReady,
  listQuery,
  tableView,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListDefinition,
  type ListQuery,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { compactPhoneSearch } from '../contacts/contact-search';
import type {
  LeadSortField,
  LeadStage,
  LeadStatusFilter,
  SalesLeadsQuery,
} from '../generated/leads-operations';
import { leadLabel } from './lead-record';
import { leadStageOptions, leadStages, leadStageSeverity } from './lead-stage';
import { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

type LeadFilters = { stage: LeadStage | 'ALL'; status: LeadStatusFilter };
const statuses = ['OPEN', 'CLOSED', 'ALL'] as const satisfies readonly LeadStatusFilter[];
const definition: ListDefinition<LeadFilters, LeadSortField> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'DISPLAY_NAME' },
    { param: 'createdAt', field: 'CREATED_AT' },
  ],
  defaultSort: { field: 'CREATED_AT', direction: 'DESC' },
  filters: {
    stage: codecs.choice([...leadStages, 'ALL'], 'ALL'),
    status: codecs.choice(statuses, 'OPEN'),
  },
};

@Component({
  selector: 'holita-leads-page',
  imports: [
    PageHeader,
    TablePanel,
    FilterBuilder,
    FormsModule,
    ListSortMenu,
    Select,
    TableModule,
    Tag,
    RouterLink,
    RouterOutlet,
  ],
  templateUrl: './leads-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsPage {
  private readonly api = inject(LeadsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);
  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly detailOpen = computed(() => {
    this.router.lastSuccessfulNavigation();
    return this.route.firstChild?.snapshot.paramMap.has('recordId') ?? false;
  });
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
  protected readonly compactPhoneSearch = compactPhoneSearch;
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly title = computed(() => operatorStrings[this.language()].leads);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly trackById = trackById;
  protected readonly leadLabel = leadLabel;
  protected readonly stageSeverity = leadStageSeverity;
  protected readonly stageLabel = (stage: LeadStage) => this.text().stages[stage];
  protected readonly stageOptions = computed(() => [
    { value: 'ALL', label: this.text().allStages },
    ...leadStageOptions(this.language()),
  ]);
  protected readonly statusOptions = computed(() =>
    statuses.map((status) => ({ value: status, label: this.text().statuses[status] })),
  );
  protected readonly format = injectDisplayFormat();
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() => [
    { id: 'new', label: this.text().newLead, primary: true },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().leadDisplayName,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'stage', label: this.text().leadStage, width: '10rem', kind: 'status' },
    {
      id: 'website',
      label: this.text().leadWebsiteUrl,
      width: '25%',
      className: 'app-table-merged-column',
    },
    {
      id: 'source',
      label: this.text().leadSourceName,
      width: '10rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'created',
      label: this.text().leadCreatedAt,
      width: '10rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
  ]);
  protected readonly sortFields = computed(() => [
    { field: 'DISPLAY_NAME', label: this.text().leadDisplayName },
    { field: 'CREATED_AT', label: this.text().leadCreatedAt },
  ]);
  protected readonly sort = computed<NonNullable<ListQuery['sort']>>(() => {
    const { field, direction } = this.url.state().sort;
    return { field, direction: direction === 'ASC' ? 'asc' : 'desc' };
  });
  protected readonly list = resource({
    params: () => {
      const scope = this.api.scope();
      const { page, pageSize, search, sort, filter } = this.url.state();
      return scope
        ? {
            scope,
            variables: {
              offset: (page - 1) * pageSize,
              limit: pageSize,
              search,
              sort,
              stage: filter.stage === 'ALL' ? undefined : filter.stage,
              status: filter.status,
            },
          }
        : undefined;
    },
    loader: ({ params }) => this.api.list(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<LeadsApi['scope']>; data: SalesLeadsQuery['leads'] | undefined },
    SalesLeadsQuery['leads'] | null
  >({
    source: () => ({
      scope: this.api.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? (previous?.value ?? null) : null),
  });
  protected readonly view = computed(() => {
    const { search, filter } = this.url.state();
    return tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered:
        !!search || (filter.stage ?? 'ALL') !== 'ALL' || (filter.status ?? 'OPEN') !== 'OPEN',
    });
  });
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message, recordId }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
      if (recordId && !this.detailOpen()) {
        this.open(recordId);
      }
    },
  };

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }

  protected changeSort({ field, direction }: NonNullable<ListQuery['sort']>): void {
    if (field === 'DISPLAY_NAME' || field === 'CREATED_AT') {
      this.url.setSort(field, direction === 'asc' ? 'ASC' : 'DESC');
    }
  }

  protected tableSort(event: TableLazyLoadEvent): void {
    if (this.sortReady()) {
      const sort = listQuery.sorted(
        { ...this.url.state(), sort: this.sort(), conditions: [] },
        event,
      )?.sort;
      if (sort) {
        this.changeSort(sort);
      }
    }
  }

  protected open(path: string): void {
    void this.router.navigate([path], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
