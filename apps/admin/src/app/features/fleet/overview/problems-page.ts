import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Refresh } from '@primeicons/angular/refresh';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDashboardProblemsQuery,
  FleetEventSeverity,
  FleetProblemSourceKind,
  FleetProblemState,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { FormField } from '../../../ui/form-field/form-field';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { FormatNumberPipe } from '../../../ui/format/format.pipes';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../../ui/list/list-actions';
import { UrlListState } from '../../../ui/list/url-list-state';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { selectMultiplePt } from '../../../ui/select-multiple';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { ProblemsApi } from './problems-api';
import {
  problemSeverityTones,
  problemStateTones,
  problemsText,
  problemTitle,
} from './problems-presentation';
import {
  problemDefinition,
  problemSeverities,
  problemSources,
  problemStates,
  problemVariables,
} from './problems-query';

type Problem = AdminDashboardProblemsQuery['fleetProblems']['items'][number];
type ProblemAction = 'open' | 'vehicle' | 'device';

@Component({
  selector: 'holita-problems-page',
  imports: [
    ButtonDirective,
    FormField,
    FormatNumberPipe,
    FormsModule,
    PageHeader,
    Refresh,
    RouterOutlet,
    RowActions,
    Select,
    TableModule,
    TablePanel,
    Tag,
  ],
  providers: [ProblemsApi],
  templateUrl: './problems-page.html',
  styleUrl: './problems-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class ProblemsPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(ProblemsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notices = inject(MessageService);
  protected readonly format = injectFleetFormat();
  protected readonly url = new UrlListState(problemDefinition);
  protected readonly text = computed(() => problemsText(this.language()));
  protected readonly selectMultiplePt = selectMultiplePt;
  protected readonly trackById = trackById;
  protected readonly tableMinWidth = '68rem';
  private query: ReturnType<ProblemsApi['watch']> | undefined;
  protected readonly page = signal<AdminDashboardProblemsQuery['fleetProblems'] | null>(null);
  protected readonly loading = signal(true);
  private readonly error = signal<unknown>(null);
  protected readonly failure = computed(() => requestError(this.error(), this.text().table.error));
  protected readonly filtered = computed(() => {
    const filter = this.url.state().filter;
    return !!(
      filter.source?.length ||
      filter.severity?.length ||
      filter.state?.length ||
      filter.vehicleIds?.length ||
      filter.deviceIds?.length ||
      filter.attention !== undefined ||
      filter.from ||
      filter.to
    );
  });
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).map((problem) => ({
      ...problem,
      title: problemTitle(problem, this.language()),
      detail: problem.details ?? '',
      sourceLabel: this.text().sources[problem.sourceKind],
      sourceTitle: `${this.text().table.sourceIdentity}: ${problem.sourceKind} · ${problem.sourceId}`,
      severityLabel: this.text().severities[problem.severity],
      severitySeverity: toneSeverity(problemSeverityTones[problem.severity]),
      stateLabel: this.text().states[problem.state],
      stateSeverity: toneSeverity(problemStateTones[problem.state]),
      date: this.format.dateTimeCell(problem.occurredAt),
    })),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: this.filtered(),
    }),
  );
  protected readonly sources = computed(() =>
    problemSources.map((value) => ({ value, label: this.text().sources[value] })),
  );
  protected readonly severities = computed(() =>
    problemSeverities.map((value) => ({ value, label: this.text().severities[value] })),
  );
  protected readonly states = computed(() =>
    problemStates.map((value) => ({ value, label: this.text().states[value] })),
  );
  protected readonly attentionOptions = computed(() => [
    { value: null, label: this.text().filters.allProblems },
    { value: true, label: this.text().filters.needsAttention },
    { value: false, label: this.text().filters.recordedOnly },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'problem',
      label: this.text().table.problem,
      width: '16rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'source',
      label: this.text().table.source,
      width: '10rem',
      className: 'app-col-secondary',
    },
    { id: 'severity', label: this.text().table.severity, width: '8rem', kind: 'status' },
    { id: 'state', label: this.text().table.state, width: '10rem', kind: 'status' },
    { id: 'time', label: this.text().table.time, width: '11rem', kind: 'date' },
    { id: 'target', label: this.text().table.target, width: '10rem', kind: 'identity' },
    {
      id: 'actions',
      label: this.text().table.actions,
      width: '3rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly actions = computed<readonly ListAction<ProblemAction, Problem>[]>(() => [
    {
      id: 'open',
      label: this.text().table.open,
      appliesTo: (problem) => !!(problem.alertId || problem.deviceId || problem.vehicleId),
    },
    {
      id: 'vehicle',
      label: this.text().table.openVehicle,
      appliesTo: (problem) => !!problem.vehicleId,
    },
    {
      id: 'device',
      label: this.text().table.openDevice,
      appliesTo: (problem) => !!problem.deviceId,
    },
  ]);
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (!this.destroyRef.destroyed) {
        this.notices.add({ severity: 'success', summary: message, life: 5000 });
        this.refresh();
      }
    },
  };

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.loading.set(true);
          this.error.set(null);
          this.query = this.api.watch(problemVariables(state));
          return this.query.valueChanges.pipe(
            catchError((error: unknown) => {
              this.error.set(error);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error && !result.loading) {
          this.acceptPage(result.data.fleetProblems);
        }
      });
  }

  private acceptPage(page: AdminDashboardProblemsQuery['fleetProblems']): void {
    this.page.set(page);
    this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
  }

  protected sourceChanged(value: readonly FleetProblemSourceKind[] | null): void {
    this.url.patchFilter({ source: value ?? [] });
  }
  protected severityChanged(value: readonly FleetEventSeverity[] | null): void {
    this.url.patchFilter({ severity: value ?? [] });
  }
  protected stateChanged(value: readonly FleetProblemState[] | null): void {
    this.url.patchFilter({ state: value ?? [] });
  }
  protected attentionChanged(value: boolean | null): void {
    const filter = { ...this.url.state().filter };
    if (value === null) {
      delete filter.attention;
    } else {
      filter.attention = value;
    }
    this.url.setState({
      ...this.url.state(),
      filter,
      page: 1,
    });
  }
  protected recordOf(problem: Problem) {
    return listRecord(
      this.actions(),
      problem,
      problem.id,
      `${problemTitle(problem, this.language())} · ${problem.vehicle?.licensePlate ?? problem.deviceImei ?? this.text().table.noTarget}`,
    );
  }
  protected run({ action, ids }: ListActionRequest<ProblemAction>): void {
    const problem = this.page()?.items.find((item) => item.id === ids[0]);
    if (!problem) {
      return;
    }
    if (action === 'open' && problem.alertId) {
      void this.router.navigate([problem.alertId], {
        relativeTo: this.route,
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
      return;
    }
    if ((action === 'device' || action === 'open') && problem.deviceId) {
      void this.router.navigate([
        '/',
        this.language(),
        this.branch().id,
        'fleet',
        'devices',
        problem.deviceId,
        ...(problem.commandRequestId
          ? ['commands']
          : problem.ermEventId
            ? ['technical-details', 'events']
            : ['overview']),
      ]);
      return;
    }
    if (problem.vehicleId) {
      void this.router.navigate([
        '/',
        this.language(),
        this.branch().id,
        'fleet',
        'vehicles',
        problem.vehicleId,
        'problems',
      ]);
    }
  }

  refresh(): void {
    const query = this.query;
    if (!query) {
      return;
    }
    this.loading.set(true);
    void query
      .refetch()
      .then((result) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.loading.set(false);
          this.error.set(result.error ?? null);
          if (result.data && !result.error) {
            this.acceptPage(result.data.fleetProblems);
          }
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.error.set(error);
          this.loading.set(false);
        }
      });
  }
}
