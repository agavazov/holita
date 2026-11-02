import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { EMPTY, Subject, catchError, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { uiMessages } from '../../../ui/i18n/messages';
import {
  type ListAction,
  type ListActionRequest,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { ListSortMenu } from '../../../ui/list/list-sort-menu';
import { listStateParams } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { ScenariosApi } from '../scenarios/scenarios-api';
import {
  diagnosticsLink,
  vehicleSummaryBackLink,
  type DiagnosticSection,
} from './diagnostic-navigation';
import { DiagnosticsHeader } from './diagnostics-header';
import { VehicleSummaryDrawer } from './vehicle-summary-drawer';
import { LogDetails } from './log-details';
import {
  filteredLogs,
  logEvaluation,
  logFault,
  logFields,
  logSignal,
  logSourceRows,
  type DiagnosticLog,
  type DiagnosticScenario,
} from './log-mapping';
import { logDefinition } from './log-query';
import bg from './logs.bg.json';
import en from './logs.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-logs-page',
  imports: [
    RouterLink,
    ButtonDirective,
    TableModule,
    Tag,
    RouteDrawer,
    EmptyState,
    FilterBuilder,
    ListSortMenu,
    RowActions,
    TablePanel,
    DiagnosticsHeader,
    VehicleSummaryDrawer,
    LogDetails,
  ],
  providers: [ScenariosApi],
  templateUrl: './logs-page.html',
  styleUrl: './logs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class LogsPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  private readonly api = inject(ScenariosApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = new UrlListState(logDefinition);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly reload = new Subject<void>();
  protected readonly scenario = signal<DiagnosticScenario | null>(null);
  protected readonly loading = signal(true);
  private readonly error = signal<unknown>(null);
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly source = computed(() => this.url.state().filter.source ?? 'HOLITA_SCENARIO');
  protected readonly illustrative = computed(() => this.source() === 'HOLITA_SCENARIO');
  protected readonly hasRiskContext = computed(() => this.params().has('riskContext'));
  protected readonly vehicleSummaryOpen = computed(() => this.params().has('vehicleSummary'));
  protected readonly returnVehicleLink = computed(() =>
    vehicleSummaryBackLink(this.router, this.branchId(), this.language(), this.params()),
  );
  protected readonly sectionLinks = computed(() => ({
    faults: this.link('faults'),
    logs: this.link('logs'),
    risk: this.link('risk'),
  }));
  protected readonly hasFaultContext = computed(() => this.params().has('faultContext'));
  protected readonly fields = computed(() => logFields(this.scenario(), this.text()));
  protected readonly failure = computed(() =>
    this.error() ? requestError(this.error(), this.text().loadError) : null,
  );
  protected readonly logs = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? filteredLogs(scenario, this.url.state(), this.text())
      : null;
  });
  protected readonly rows = computed(() => {
    const state = this.url.state();
    return this.logs()?.slice((state.page - 1) * state.pageSize, state.page * state.pageSize) ?? [];
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.logs()?.length ?? null,
      filtered: !!this.url.state().search || !!this.url.state().filter.conditions?.length,
    }),
  );
  protected readonly actions = computed<readonly ListAction<'open', DiagnosticLog>[]>(() => [
    { id: 'open', label: this.text().open },
  ]);
  protected readonly trackById = trackById;
  protected readonly sortFields = computed(() => [
    { field: 'eventAt', label: this.text().recordTime },
  ]);
  protected readonly sort = computed(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? ('asc' as const) : ('desc' as const),
  }));
  protected readonly selectedId = computed(() =>
    this.illustrative() ? this.params().get('log') : null,
  );
  protected readonly selectedLog = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? (logSourceRows(scenario).find((log) => log.id === this.selectedId()) ?? null)
      : null;
  });
  protected readonly selectedOutsideFilters = computed(
    () => !!this.selectedLog() && !this.logs()?.some((log) => log.id === this.selectedId()),
  );
  protected readonly drawerState = computed<RouteDrawerState>(() =>
    this.loading() && !this.scenario()
      ? 'loading'
      : this.error()
        ? 'error'
        : this.selectedLog()
          ? 'ready'
          : 'not-found',
  );
  protected readonly faultLink = computed(() => {
    const log = this.selectedLog();
    const scenario = this.scenario();
    const fault = log && scenario ? logFault(scenario, log) : null;
    return fault ? this.link('faults', fault.id) : null;
  });
  protected readonly riskLink = computed(() => {
    const log = this.selectedLog();
    const scenario = this.scenario();
    const evaluation = log && scenario ? logEvaluation(scenario, log) : null;
    return evaluation ? this.link('risk', evaluation.id) : null;
  });
  protected readonly logLink = (id: string) => this.link('logs', id);

  constructor() {
    effect(() => {
      const count = this.logs()?.length;
      if (count !== undefined) {
        this.url.correctPage(Math.max(1, Math.ceil(count / this.url.state().pageSize)));
      }
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    this.url.changes
      .pipe(
        map((state) => state.filter.source ?? 'HOLITA_SCENARIO'),
        distinctUntilChanged(),
        switchMap((source) =>
          this.reload.pipe(
            startWith(undefined),
            switchMap(() => {
              this.scenario.set(null);
              this.error.set(null);
              this.loading.set(source === 'HOLITA_SCENARIO');
              return source === 'HOLITA_SCENARIO'
                ? this.api.watchDiagnostics('operational-day-v1').valueChanges.pipe(
                    catchError((error: unknown) => {
                      this.loading.set(false);
                      this.error.set(error);
                      return EMPTY;
                    }),
                  )
                : EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.scenario.set(result.data.fleetScenario);
        }
      });
  }

  protected changeSource(value: unknown): void {
    if (value !== 'HOLITA_SCENARIO' && value !== 'KARMA_API') {
      return;
    }
    const state = this.url.state();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...listStateParams(
          { ...state, page: 1, search: '', filter: { source: value } },
          logDefinition,
        ),
        fault: null,
        log: null,
        evaluation: null,
        vehicleSummary: null,
        vehicleContext: null,
        riskContext: null,
        faultContext: null,
        logContext: null,
      },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected refresh(): void {
    this.reload.next();
  }

  protected openLog(request: ListActionRequest<'open'>): void {
    const id = request.ids[0];
    if (id) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { log: id },
        queryParamsHandling: 'merge',
        preserveFragment: true,
      });
    }
  }

  protected closeLog(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { log: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected vehicleLink(id: string, selectedId?: string) {
    return this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { vehicleSummary: id, log: selectedId ?? this.params().get('log') },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected link(section: DiagnosticSection, selectedId?: string) {
    return diagnosticsLink(
      this.router,
      this.branchId(),
      this.language(),
      'logs',
      section,
      this.params(),
      selectedId,
    );
  }

  protected recordOf(log: DiagnosticLog) {
    return listRecord(this.actions(), log, log.id, `${this.text().kinds[log.kind]} ${log.id}`);
  }

  protected kindLabel(log: DiagnosticLog): string {
    return this.text().kinds[log.kind];
  }
  protected severityLabel(log: DiagnosticLog): string {
    return this.text().severities[log.severity];
  }

  protected summary(log: DiagnosticLog): string {
    const scenario = this.scenario();
    if (!scenario) {
      return this.text().noRelatedRecord;
    }
    const signal = logSignal(scenario, log);
    if (signal) {
      const value =
        signal.value == null
          ? this.text().unavailableValue
          : `${formatNumber(signal.value, this.language(), { significantDigits: 15 })} ${this.text().units[signal.unit]}`;
      return `${this.text().signals[signal.signal]} · ${value}`;
    }
    const evaluation = logEvaluation(scenario, log);
    if (evaluation) {
      return `${this.text().rules[evaluation.rule]} · ${this.text().evaluationStates[evaluation.state]}`;
    }
    const fault = logFault(scenario, log);
    if (fault) {
      return fault.code;
    }
    return log.reason ? this.text().reasons[log.reason] : this.text().noRelatedRecord;
  }

  protected vehicleLabel(id: string): string {
    return this.scenario()?.vehicles.find((vehicle) => vehicle.id === id)?.label ?? id;
  }

  protected time(value: string | null | undefined): string {
    return formatDateTime(
      value,
      this.language(),
      this.scenario()?.period.timeZone ?? 'Europe/Sofia',
      true,
    );
  }

  protected severity(value: DiagnosticLog['severity']) {
    return toneSeverity(value === 'CRITICAL' ? 'danger' : value === 'WARNING' ? 'warn' : 'info');
  }
}
