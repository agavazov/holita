import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  codecs,
  injectDisplayFormat,
  tableView,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { filter } from 'rxjs';
import type { SalesTaskBucket, SalesTaskQueueQuery } from '../generated/leads-operations';
import { agentLabel, injectLeadAgents } from './lead-agent';
import { leadLabel } from './lead-record';
import { leadStrings } from './lead-strings';
import { leadTaskSeverity } from './lead-task';
import { LeadTasksApi } from './lead-tasks-api';

const buckets = {
  overdue: 'OVERDUE',
  today: 'TODAY',
  upcoming: 'UPCOMING',
  noFollowUp: 'NO_FOLLOW_UP',
} as const satisfies Record<string, SalesTaskBucket>;
const bucketKeys = ['overdue', 'today', 'upcoming', 'noFollowUp'] as const;
const scopes = ['mine', 'team'] as const;
type BucketKey = (typeof bucketKeys)[number] | 'all';
type TaskFilters = { scope: (typeof scopes)[number] | 'default'; bucket: BucketKey };
type QueueGroup = SalesTaskQueueQuery['salesTaskQueue'][number];
type QueueRow = QueueGroup['items'][number];
type QueuePanel = { key: BucketKey; total: number | null; items: QueueRow[] };
const definition: ListDefinition<TaskFilters, 'SCHEDULED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'SCHEDULED_AT', direction: 'ASC' },
  filters: {
    scope: codecs.choice([...scopes, 'default'], 'default'),
    bucket: codecs.choice(['all', ...bucketKeys], 'all'),
  },
};

@Component({
  selector: 'holita-tasks-page',
  imports: [PageHeader, TablePanel, RouterLink, ButtonDirective, TableModule, Tag],
  templateUrl: './tasks-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage {
  private readonly api = inject(LeadTasksApi);
  private readonly agents = injectLeadAgents('assigned');
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly title = computed(() => operatorStrings[this.language()].tasks);
  protected readonly text = computed(() => leadStrings[this.language()]);
  protected readonly labels = computed(() => this.text().taskQueue);
  protected readonly format = injectDisplayFormat();
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
  protected readonly scopes = scopes;
  protected readonly bucketOptions = ['all', ...bucketKeys] as const;
  protected readonly scope = computed(() =>
    this.url.state().filter.scope === 'team' ? 'team' : 'mine',
  );
  protected readonly bucket = computed(() => this.url.state().filter.bucket ?? 'all');
  protected readonly viewAllNavigation = {};
  private readonly panel = viewChild(TablePanel);
  private readonly queueContext = computed(() => ({
    session: this.api.scope(),
    scope: this.scope(),
    bucket: this.bucket(),
  }));
  protected readonly queue = resource({
    params: () => {
      const { session, scope, bucket } = this.queueContext();
      const { page, pageSize } = this.url.state();
      return session
        ? {
            scope: session,
            variables: {
              scope: scope === 'team' ? ('TEAM' as const) : ('MINE' as const),
              bucket: bucket === 'all' ? null : buckets[bucket],
              offset: bucket === 'all' ? 0 : (page - 1) * pageSize,
              limit: pageSize,
            },
          }
        : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.queue(params.scope, params.variables, abortSignal),
  });
  private readonly displayedGroups = linkedSignal({
    source: () => ({
      context: this.queueContext(),
      data: this.queue.hasValue() ? this.queue.value() : undefined,
    }),
    computation: ({ context, data }, previous): QueueGroup[] =>
      data ?? (previous?.source.context === context ? previous.value : []),
  });
  protected readonly groups = computed<QueuePanel[]>(() => {
    const selected = this.bucket();
    const panels = this.displayedGroups().flatMap((group) => {
      const key = bucketKeys.find((key) => buckets[key] === group.bucket);
      return key && (selected !== 'all' || group.total > 0)
        ? [{ key, total: group.total, items: group.items }]
        : [];
    });
    return panels.length ? panels : [{ key: selected, total: null, items: [] }];
  });
  private readonly leadColumn = computed<TableColumn>(() => ({
    id: 'lead',
    label: this.text().lead,
    width: 'auto',
    kind: 'identity',
    className: 'app-col-identity',
  }));
  private readonly agentColumn = computed<TableColumn>(() => ({
    id: 'agent',
    label: this.text().assignedAgent,
    width: '12rem',
    className: 'app-table-merged-column',
  }));
  protected readonly leadColumns = computed(() => [this.leadColumn(), this.agentColumn()]);
  protected readonly taskColumns = computed<readonly TableColumn[]>(() => [
    this.leadColumn(),
    { id: 'status', label: this.labels().status, width: '10rem', kind: 'status' },
    {
      id: 'type',
      label: this.text().taskType,
      width: '12rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'scheduledAt',
      label: this.text().taskScheduledAt,
      width: '12rem',
      className: 'app-table-merged-column',
    },
    this.agentColumn(),
  ]);
  protected readonly leadLabel = leadLabel;
  protected readonly taskSeverity = leadTaskSeverity;
  protected readonly trackRow = (_index: number, row: QueueRow) => row.task?.id ?? row.lead.id;

  constructor() {
    const router = inject(Router);
    const injector = inject(Injector);
    router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd &&
            router.currentNavigation()?.extras.info === this.viewAllNavigation,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        afterNextRender(() => this.panel()?.focusHeading(), { injector });
      });
    effect(() => {
      if (this.queue.hasValue() && !this.queue.isLoading()) {
        const total = this.bucket() === 'all' ? 0 : (this.queue.value()[0]?.total ?? 0);
        this.url.correctPage(Math.ceil(total / this.url.state().pageSize));
      }
    });
  }

  protected view(rows: number) {
    return tableView({
      rows,
      loading: this.queue.isLoading(),
      error: this.queue.error(),
      filtered: false,
    });
  }

  protected taskFor(row: QueueRow) {
    return row.task;
  }

  protected assignee(id: string | null | undefined): string {
    if (!id) {
      return this.text().assignments.unassigned;
    }
    if (this.agents.isLoading()) {
      return '—';
    }
    const agent = this.agents.hasValue()
      ? this.agents.value().find((agent) => agent.id === id)
      : undefined;
    return agentLabel(agent, this.text());
  }
}
