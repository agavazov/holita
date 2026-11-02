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
import { ActivatedRoute, Router, RouterLink, convertToParamMap } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { EMPTY, Subject, catchError, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { uiMessages } from '../../../ui/i18n/messages';
import { type ListAction, type ListActionRequest, listRecord } from '../../../ui/list/list-actions';
import { ListSortMenu } from '../../../ui/list/list-sort-menu';
import { listStateParams } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { ScenariosApi } from '../scenarios/scenarios-api';
import {
  diagnosticsLink,
  vehicleSummaryBackLink,
  type DiagnosticSection,
} from './diagnostic-navigation';
import { DiagnosticsHeader } from './diagnostics-header';
import { VehicleSummaryDrawer } from './vehicle-summary-drawer';
import { RiskEvidence } from './risk-evidence';
import {
  evaluationFault,
  filteredRisk,
  riskFields,
  riskSourceRows,
  type DiagnosticEvaluation,
} from './risk-mapping';
import type { DiagnosticScenario } from './fault-mapping';
import { riskDefinition } from './risk-query';
import { attentionText, DiagnosticsReview, reviewField } from './diagnostics-review';
import { DiagnosticReviewControls } from './diagnostic-review-controls';
import { DiagnosticBriefPanel } from './diagnostic-brief-panel';
import bg from './risk-page.bg.json';
import en from './risk-page.en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-risk-page',
  imports: [
    RouterLink,
    ButtonDirective,
    RouteDrawer,
    EmptyState,
    FilterBuilder,
    ListSortMenu,
    TablePanel,
    DiagnosticsHeader,
    DiagnosticReviewControls,
    DiagnosticBriefPanel,
    VehicleSummaryDrawer,
    RiskEvidence,
  ],
  providers: [ScenariosApi],
  templateUrl: './risk-page.html',
  styleUrl: './risk-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class RiskPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  protected readonly review = inject(DiagnosticsReview);
  protected readonly attention = computed(() => attentionText[this.language()]);
  private readonly api = inject(ScenariosApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = new UrlListState(riskDefinition);
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
  protected readonly hasLogContext = computed(() => this.params().has('logContext'));
  protected readonly fields = computed(() => [
    ...riskFields(this.scenario(), this.text()),
    reviewField(this.language()),
  ]);
  protected readonly failure = computed(() =>
    this.error() ? requestError(this.error(), this.text().loadError) : null,
  );
  protected readonly evaluations = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? filteredRisk(scenario, this.url.state(), this.text()).filter((row) =>
          this.review.matches('risk', row.id, this.url.state().filter.conditions ?? []),
        )
      : null;
  });
  protected readonly rows = computed(() => {
    const state = this.url.state();
    return (
      this.evaluations()?.slice((state.page - 1) * state.pageSize, state.page * state.pageSize) ??
      []
    );
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.evaluations()?.length ?? null,
      filtered: !!this.url.state().search || !!this.url.state().filter.conditions?.length,
    }),
  );
  protected readonly actions = computed<readonly ListAction<'open', DiagnosticEvaluation>[]>(() => [
    { id: 'open', label: this.text().open },
  ]);
  protected readonly sortFields = computed(() => [{ field: 'window', label: this.text().window }]);
  protected readonly sort = computed(() => ({
    field: this.url.state().sort.field,
    direction: this.url.state().sort.direction === 'ASC' ? ('asc' as const) : ('desc' as const),
  }));
  protected readonly selectedId = computed(() =>
    this.illustrative() ? this.params().get('evaluation') : null,
  );
  protected readonly selectedEvaluation = computed(() => {
    const scenario = this.scenario();
    return this.illustrative() && scenario
      ? (riskSourceRows(scenario).find((row) => row.id === this.selectedId()) ?? null)
      : null;
  });
  protected readonly selectedOutsideFilters = computed(
    () =>
      !!this.selectedEvaluation() &&
      !this.evaluations()?.some((row) => row.id === this.selectedId()),
  );
  protected readonly drawerState = computed<RouteDrawerState>(() =>
    this.loading() && !this.scenario()
      ? 'loading'
      : this.error()
        ? 'error'
        : this.selectedEvaluation()
          ? 'ready'
          : 'not-found',
  );
  protected faultLink(evaluation: DiagnosticEvaluation) {
    const scenario = this.scenario();
    const fault = scenario ? evaluationFault(scenario, evaluation) : null;
    return fault ? this.referenceLink(evaluation, 'faults', fault.id) : null;
  }
  protected contributorLinks(evaluation: DiagnosticEvaluation) {
    return (id: string) => this.referenceLink(evaluation, 'logs', id);
  }
  private referenceLink(evaluation: DiagnosticEvaluation, target: DiagnosticSection, id: string) {
    return diagnosticsLink(
      this.router,
      this.branchId(),
      this.language(),
      'risk',
      target,
      convertToParamMap({ ...this.route.snapshot.queryParams, evaluation: evaluation.id }),
      id,
    );
  }
  protected readonly drawerSubtitle = computed(() => {
    const evaluation = this.selectedEvaluation();
    return evaluation ? this.text().rules[evaluation.rule] : this.selectedId();
  });

  constructor() {
    effect(() => {
      const count = this.evaluations()?.length;
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
          riskDefinition,
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

  protected openEvaluation(request: ListActionRequest<'open'>): void {
    const id = request.ids[0];
    if (id) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { evaluation: id },
        queryParamsHandling: 'merge',
        preserveFragment: true,
      });
    }
  }

  protected closeEvaluation(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { evaluation: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected vehicleLink(id: string, selectedId?: string) {
    return this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: {
        vehicleSummary: id,
        evaluation: selectedId ?? this.params().get('evaluation'),
      },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected link(section: DiagnosticSection, selectedId?: string) {
    return diagnosticsLink(
      this.router,
      this.branchId(),
      this.language(),
      'risk',
      section,
      this.params(),
      selectedId,
    );
  }

  protected recordOf(evaluation: DiagnosticEvaluation) {
    return listRecord(
      this.actions(),
      evaluation,
      evaluation.id,
      this.text().rules[evaluation.rule],
    );
  }
}
