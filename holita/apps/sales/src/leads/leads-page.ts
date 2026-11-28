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
  LeadAssignmentFilter,
  LeadSortField,
  LeadStage,
  LeadStatusFilter,
  SalesLeadsQuery,
} from '../generated/leads-operations';
import { agentLabel, injectLeadAgents } from './lead-agent';
import { leadLabel } from './lead-record';
import { leadStageOptions, leadStages, leadStageSeverity } from './lead-stage';
import { leadStrings } from './lead-strings';
import { LeadsApi } from './leads-api';

type LeadFilters = { stage: LeadStage | 'ALL'; status: LeadStatusFilter; agent: string };
const statuses = ['OPEN', 'CLOSED', 'ALL'] as const satisfies readonly LeadStatusFilter[];
const assignments = ['mine', 'all', 'unassigned'] as const;
const assignmentIds = codecs.idList(1);
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
    agent: {
      read: (values) =>
        assignments.find((value) => value === values[0]) ??
        assignmentIds.read(values)?.[0] ??
        'all',
      write: (value) => (value === 'all' ? null : (value ?? null)),
      same: (a, b) => (a ?? 'all') === (b ?? 'all'),
    },
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
  protected readonly nextTaskFor = (lead: SalesLeadsQuery['leads']['items'][number]) =>
    lead.nextTask;
  protected readonly stageOptions = computed(() => [
    { value: 'ALL', label: this.text().allStages },
    ...leadStageOptions(this.language()),
  ]);
  protected readonly statusOptions = computed(() =>
    statuses.map((status) => ({ value: status, label: this.text().statuses[status] })),
  );
  protected readonly team = injectLeadAgents('assigned');
  protected readonly agentFilter = computed(() => this.url.state().filter.agent ?? 'all');
  private readonly specificAgent = computed(() => assignmentIds.read([this.agentFilter()])?.[0]);
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
    { id: 'stage', label: this.text().leadStage, width: '9rem', kind: 'status' },
    {
      id: 'nextTask',
      label: this.text().nextTask,
      width: '17%',
      className: 'app-table-merged-column',
    },
    {
      id: 'agent',
      label: this.text().assignedAgent,
      width: '13%',
      className: 'app-table-merged-column',
    },
    {
      id: 'website',
      label: this.text().leadWebsiteUrl,
      width: '14%',
      className: 'app-table-merged-column',
    },
    {
      id: 'source',
      label: this.text().leadSourceName,
      width: '10%',
      className: 'app-table-merged-column',
    },
    {
      id: 'created',
      label: this.text().leadCreatedAt,
      width: '13%',
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
      const assignment: LeadAssignmentFilter | undefined =
        filter.agent === 'mine' ? 'MINE' : filter.agent === 'unassigned' ? 'UNASSIGNED' : undefined;
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
              assignment,
              assignedAgentUserId: this.specificAgent(),
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
  private readonly namesById = computed(
    () =>
      new Map((this.team.hasValue() ? this.team.value() : []).map((agent) => [agent.id, agent])),
  );
  protected readonly assigneeLabel = (id: string | null | undefined) =>
    id
      ? !this.team.hasValue() && this.team.isLoading()
        ? '—'
        : agentLabel(this.namesById().get(id), this.text())
      : this.text().assignments.unassigned;
  protected readonly agentOptions = computed(() => {
    const options = assignments.map((value): { value: string; label: string } => ({
      value,
      label: this.text().assignments[value],
    }));
    const team = this.team.hasValue() ? this.team.value() : [];
    options.push(
      ...team.map((agent) => ({ value: agent.id, label: agentLabel(agent, this.text()) })),
    );
    const selected = this.specificAgent();
    if (selected && !options.some(({ value }) => value === selected)) {
      options.push({ value: selected, label: this.assigneeLabel(selected) });
    }
    return options;
  });
  protected readonly view = computed(() => {
    const { search, filter } = this.url.state();
    return tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered:
        !!search ||
        (filter.stage ?? 'ALL') !== 'ALL' ||
        (filter.status ?? 'OPEN') !== 'OPEN' ||
        this.agentFilter() !== 'all',
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
      this.team.reload();
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
