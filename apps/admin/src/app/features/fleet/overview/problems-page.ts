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
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Refresh } from '@primeicons/angular/refresh';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Dialog } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDashboardProblemsQuery,
  AdminDashboardCurrentWarningsQuery,
  FleetEventSeverity,
  FleetFaultSystem,
  FleetProblemSourceKind,
  FleetProblemState,
} from '../../../../generated/graphql/operations';
import {
  faultsText,
  faultDescription,
  faultFmi,
  faultSystem,
  warningLampLabel,
  warningLampSystem,
  warningStateLabel,
  warningTone,
} from '../../../ui/fleet-live/fault-wording';
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
import { uiMessages } from '../../../ui/i18n/messages';
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
  problemSystems,
  problemSources,
  problemStates,
  problemVariables,
} from './problems-query';

type Problem = AdminDashboardProblemsQuery['fleetProblems']['items'][number];
type ProblemAction = 'details' | 'open' | 'vehicle' | 'device';

@Component({
  selector: 'holita-problems-page',
  imports: [
    ButtonDirective,
    Dialog,
    FormField,
    FormatNumberPipe,
    FormsModule,
    PageHeader,
    Refresh,
    RouterOutlet,
    RouterLink,
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
  protected readonly tableMinWidth = '79rem';
  private readonly reload = new Subject<void>();
  protected readonly selectedProblem = signal<Problem | null>(null);
  protected readonly uiText = computed(() => uiMessages[this.language()]);
  protected readonly faultText = computed(() => faultsText(this.language()));
  protected readonly warningVehicles = signal<
    AdminDashboardCurrentWarningsQuery['fleetVehicles'] | null
  >(null);
  protected readonly warningsLoading = signal(true);
  private readonly warningsError = signal<unknown>(null);
  protected readonly warningsFailure = computed(() =>
    requestError(this.warningsError(), this.text().warningsError),
  );
  protected readonly page = signal<AdminDashboardProblemsQuery['fleetProblems'] | null>(null);
  protected readonly loading = signal(true);
  private readonly error = signal<unknown>(null);
  protected readonly failure = computed(() => requestError(this.error(), this.text().table.error));
  protected readonly filtered = computed(() => {
    const filter = this.url.state().filter;
    return !!(
      filter.system?.length ||
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
  protected readonly history = computed(() => {
    const systems = this.url.state().filter.system;
    return (this.page()?.items ?? []).filter(
      (problem) =>
        !systems?.length ||
        problem.diagnostics.some((diagnostic) => systems.includes(diagnostic.systemKey)),
    );
  });
  protected readonly attentionCount = computed(
    () =>
      this.warnings().length +
      this.history().filter((problem) => problem.requiringAttention).length,
  );
  protected readonly recordedCount = computed(
    () => this.history().filter((problem) => problem.state === 'RECORDED').length,
  );
  protected readonly historyTotal = computed(() => (this.page() ? this.history().length : null));
  protected readonly rows = computed(() => {
    const state = this.url.state();
    return this.history()
      .slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
      .map((problem) => ({
        ...problem,
        title: problemTitle(problem, this.language()),
        detail: problem.diagnostics.length ? '' : (problem.details ?? ''),
        first: this.format.dateTimeCell(
          problem.diagnostics.length
            ? problem.diagnostics.map((diagnostic) => diagnostic.firstObservedAt).sort()[0]
            : problem.occurredAt,
        ),
        last: this.format.dateTimeCell(
          problem.diagnostics.length
            ? problem.diagnostics
                .map((diagnostic) => diagnostic.lastObservedAt)
                .sort()
                .at(-1)
            : problem.occurredAt,
        ),
        diagnosticSummary: problem.diagnostics
          .map((diagnostic) =>
            [
              faultSystem(diagnostic.systemKey, this.language()),
              ...(diagnostic.fmi === null ? [] : [faultFmi(diagnostic.fmi, this.language())]),
            ].join(' · '),
          )
          .join(' · '),
        sourceLabel: this.text().sources[problem.sourceKind],
        sourceTitle: `${this.text().table.sourceIdentity}: ${problem.sourceKind} · ${problem.sourceId}`,
        severityLabel: this.text().severities[problem.severity],
        severitySeverity: toneSeverity(problemSeverityTones[problem.severity]),
        stateLabel: this.text().states[problem.state],
        stateSeverity: toneSeverity(problemStateTones[problem.state]),
      }));
  });
  protected readonly selectedDiagnostics = computed(() =>
    (this.selectedProblem()?.diagnostics ?? []).map((diagnostic) => ({
      description: faultDescription(diagnostic, this.language()),
      system: faultSystem(diagnostic.systemKey, this.language()),
      fmi:
        diagnostic.fmi === null
          ? null
          : `FMI ${String(diagnostic.fmi)} · ${faultFmi(diagnostic.fmi, this.language())}`,
      first: this.format.dateTimeCell(diagnostic.firstObservedAt),
      last: this.format.dateTimeCell(diagnostic.lastObservedAt),
      catalogVersion: diagnostic.catalogVersion,
    })),
  );
  protected readonly warnings = computed(() => {
    const filter = this.url.state().filter;
    if (
      filter.attention === false ||
      filter.source?.length ||
      (filter.state?.length && !filter.state.includes('OPEN'))
    ) {
      return [];
    }
    return (this.warningVehicles()?.items ?? []).flatMap((vehicle) =>
      vehicle.currentWarnings
        .filter((warning) => {
          const severity =
            warning.state === 'RED' ? 'CRITICAL' : warning.state === 'YELLOW' ? 'WARNING' : 'INFO';
          return (
            (!filter.system?.length ||
              filter.system.includes(warningLampSystem(warning.parameterId))) &&
            (!filter.severity?.length || filter.severity.includes(severity)) &&
            (!filter.vehicleIds?.length || filter.vehicleIds.includes(vehicle.id)) &&
            (!filter.deviceIds?.length || filter.deviceIds.includes(warning.deviceId))
          );
        })
        .map((warning) => ({
          id: `${vehicle.id}:${warning.deviceId}:${String(warning.parameterId)}`,
          vehicleId: vehicle.id,
          licensePlate: vehicle.licensePlate,
          lamp: warningLampLabel(warning.parameterId, this.language()),
          system: faultSystem(warningLampSystem(warning.parameterId), this.language()),
          state: warningStateLabel(warning.state, this.language()),
          severity: toneSeverity(warningTone(warning.state)),
          since: this.format.dateTimeCell(warning.stateSince),
        })),
    );
  });
  protected readonly warningsView = computed(() =>
    tableView({
      loading: this.warningsLoading(),
      error: this.warningsError(),
      rows: this.warningVehicles() ? this.warnings().length : null,
      filtered: this.filtered(),
    }),
  );
  protected readonly warningColumns = computed<readonly TableColumn[]>(() => [
    { id: 'vehicle', label: this.text().table.target, width: '13rem', kind: 'identity' },
    { id: 'lamp', label: this.faultText().lamp, width: '16rem', kind: 'text' },
    { id: 'state', label: this.faultText().state, width: '10rem', kind: 'status' },
    { id: 'since', label: this.faultText().since, width: '14rem', kind: 'date' },
  ]);
  protected readonly systems = computed(() =>
    problemSystems.map((value) => ({
      value,
      label: faultSystem(value, this.language()),
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
    { id: 'first', label: this.faultText().firstObserved, width: '11rem', kind: 'date' },
    { id: 'last', label: this.faultText().lastObserved, width: '11rem', kind: 'date' },
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
      id: 'details',
      label: this.text().table.details,
      appliesTo: (problem) => problem.diagnostics.length > 0,
    },
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
    const requests = this.url.changes.pipe(
      map((state) => problemVariables({ ...state, page: 1, pageSize: 100 })),
      distinctUntilChanged((previous, next) => JSON.stringify(previous) === JSON.stringify(next)),
    );
    combineLatest([requests, this.reload.pipe(startWith(undefined))])
      .pipe(
        switchMap(([variables]) => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.problems(variables).pipe(
            catchError((error: unknown) => {
              this.error.set(error);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.loading.set(false);
        this.page.set(page);
        this.url.correctPage(
          Math.max(1, Math.ceil(this.history().length / this.url.state().pageSize)),
        );
      });
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.warningsLoading.set(true);
          this.warningsError.set(null);
          return this.api.currentWarnings().pipe(
            catchError((error: unknown) => {
              this.warningsLoading.set(false);
              this.warningsError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.warningVehicles.set(page);
        this.warningsLoading.set(false);
      });
  }

  protected systemChanged(value: readonly FleetFaultSystem[] | null): void {
    this.url.patchFilter({ system: value ?? [] });
  }

  protected vehicleLink(id: string): readonly string[] {
    return ['/', this.language(), this.branch().id, 'fleet', 'vehicles', id, 'problems'];
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
    if (action === 'details') {
      this.selectedProblem.set(problem);
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
    if (action === 'open' && problem.vehicleId && problem.sourceKind === 'DIAGNOSTIC') {
      void this.router.navigate([...this.vehicleLink(problem.vehicleId)]);
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
          : problem.sourceKind === 'DIAGNOSTIC'
            ? ['problems']
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
    this.reload.next();
  }
}
