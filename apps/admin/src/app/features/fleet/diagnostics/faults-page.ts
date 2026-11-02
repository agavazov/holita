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
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
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
import { FaultDetails } from './fault-details';
import { DiagnosticsHeader } from './diagnostics-header';
import { VehicleSummaryDrawer } from './vehicle-summary-drawer';
import {
  diagnosticsLink,
  vehicleSummaryBackLink,
  type DiagnosticSection,
} from './diagnostic-navigation';
import {
  faultFields,
  faultObservations,
  faultSourceRows,
  filteredFaults,
  type DiagnosticScenario,
  type Fault,
} from './fault-mapping';
import { faultDefinition } from './fault-query';
import { attentionText, DiagnosticsReview, reviewField } from './diagnostics-review';
import { DiagnosticReviewControls } from './diagnostic-review-controls';
import { DiagnosticBriefPanel } from './diagnostic-brief-panel';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-faults-page',
  imports: [
    ButtonDirective,
    TableModule,
    Tag,
    RouteDrawer,
    EmptyState,
    FilterBuilder,
    KpiStrip,
    KpiTile,
    ListSortMenu,
    RowActions,
    TablePanel,
    FaultDetails,
    DiagnosticsHeader,
    DiagnosticReviewControls,
    DiagnosticBriefPanel,
    VehicleSummaryDrawer,
    RouterLink,
  ],
  providers: [ScenariosApi],
  templateUrl: './faults-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class FaultsPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  protected readonly review = inject(DiagnosticsReview);
  protected readonly attention = computed(() => attentionText[this.language()]);
  private readonly api = inject(ScenariosApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = new UrlListState(faultDefinition);
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
  protected readonly logLink = (id: string) => this.link('logs', id);
  protected readonly returnLogLink = computed(() =>
    this.params().get('logContext') ? this.link('logs') : null,
  );
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
  protected readonly fields = computed(() => [
    ...faultFields(this.scenario(), this.text()),
    reviewField(this.language()),
  ]);
  protected readonly failure = computed(() =>
    this.error() ? requestError(this.error(), this.text().loadError) : null,
  );
  protected readonly faults = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? filteredFaults(scenario, this.url.state(), this.text(), this.language()).filter((row) =>
          this.review.matches('fault', row.id, this.url.state().filter.conditions ?? []),
        )
      : null;
  });
  protected readonly rows = computed(() => {
    const state = this.url.state();
    return (
      this.faults()?.slice((state.page - 1) * state.pageSize, state.page * state.pageSize) ?? []
    );
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.faults()?.length ?? null,
      filtered: !!this.url.state().search || !!this.url.state().filter.conditions?.length,
    }),
  );
  protected readonly totals = computed(() => {
    const faults = this.faults();
    return faults && !this.error()
      ? {
          records: faults.length,
          active: faults.filter((fault) => fault.reportedStatus === 'ACTIVE').length,
          resolved: faults.filter((fault) => fault.reportedStatus === 'RESOLVED').length,
          occurrences: faults.reduce((total, fault) => total + fault.occurrences, 0),
        }
      : null;
  });
  protected readonly actions = computed<readonly ListAction<'open', Fault>[]>(() => [
    { id: 'open', label: this.text().open },
  ]);
  protected readonly trackById = trackById;
  protected readonly sortFields = computed(() => [
    { field: 'lastObservedAt', label: this.text().lastObservedAt },
    { field: 'code', label: this.text().code },
  ]);
  protected readonly sort = computed(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? ('asc' as const) : ('desc' as const),
  }));
  protected readonly selectedId = computed(() =>
    this.illustrative() ? this.params().get('fault') : null,
  );
  protected readonly selectedFault = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? (faultSourceRows(scenario).find((fault) => fault.id === this.selectedId()) ?? null)
      : null;
  });
  protected readonly selectedOutsideFilters = computed(
    () => !!this.selectedFault() && !this.faults()?.some((fault) => fault.id === this.selectedId()),
  );
  protected readonly observations = computed(() => {
    const fault = this.selectedFault();
    const scenario = this.scenario();
    return fault && scenario ? faultObservations(scenario, fault) : [];
  });
  protected readonly drawerState = computed<RouteDrawerState>(() =>
    this.loading() && !this.scenario()
      ? 'loading'
      : this.error()
        ? 'error'
        : this.selectedFault()
          ? 'ready'
          : 'not-found',
  );

  constructor() {
    effect(() => {
      const count = this.faults()?.length;
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
          faultDefinition,
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

  protected openFault(request: ListActionRequest<'open'>): void {
    const id = request.ids[0];
    if (id) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { fault: id },
        queryParamsHandling: 'merge',
        preserveFragment: true,
      });
    }
  }

  protected closeFault(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { fault: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected vehicleLink(id: string, selectedId?: string) {
    return this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { vehicleSummary: id, fault: selectedId ?? this.params().get('fault') },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected link(section: DiagnosticSection, selectedId?: string) {
    return diagnosticsLink(
      this.router,
      this.branchId(),
      this.language(),
      'faults',
      section,
      this.params(),
      selectedId,
    );
  }

  protected recordOf(fault: Fault) {
    return listRecord(this.actions(), fault, fault.id, fault.code);
  }
  protected codeLabel(fault: Fault): string {
    return this.text().codes[fault.code];
  }
  protected systemLabel(fault: Fault): string {
    return this.text().systems[fault.system];
  }
  protected severityLabel(fault: Fault): string {
    return this.text().severities[fault.severity];
  }
  protected statusLabel(fault: Fault): string {
    return this.text().statuses[fault.reportedStatus];
  }
  protected vehicleLabel(id: string): string {
    return this.scenario()?.vehicles.find((vehicle) => vehicle.id === id)?.label ?? id;
  }
  protected number(value: number | null | undefined): string {
    return formatNumber(value, this.language());
  }
  protected time(value: string | null | undefined): string {
    return formatDateTime(
      value,
      this.language(),
      this.scenario()?.period.timeZone ?? 'Europe/Sofia',
    );
  }
  protected severity(value: Fault['severity']) {
    return toneSeverity(value === 'CRITICAL' ? 'danger' : value === 'WARNING' ? 'warn' : 'info');
  }
}
