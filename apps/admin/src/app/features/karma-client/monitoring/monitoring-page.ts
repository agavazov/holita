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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  EMPTY,
  ReplaySubject,
  catchError,
  combineLatest,
  fromEvent,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import type {
  AdminKarmaMonitoringTrucksQuery,
  AdminKarmaMonitoringEventsQuery,
  AdminKarmaMonitoringSettingsQuery,
  FleetKarmaMonitoringCommandOutcome,
  FleetKarmaMonitoringEventKind,
  FleetKarmaMonitoringSource,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { WALL_CLOCK } from '../../../ui/clock';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { formatDateTime, formatNumber, formatRelative } from '../../../ui/format/format';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { listRecord, type ListAction, type ListActionRequest } from '../../../ui/list/list-actions';
import { UrlListState } from '../../../ui/list/url-list-state';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { uiMessages } from '../../../ui/i18n/messages';
import { MonitoringApi } from './monitoring-api';
import {
  dayBoundary,
  eventKinds,
  monitoringConditions,
  monitoringDefinition,
  monitoringFilter,
} from './monitoring-query';
import { monitoringText } from './monitoring-text';

@Component({
  selector: 'holita-karma-monitoring-page',
  imports: [
    PageHeader,
    KpiStrip,
    KpiTile,
    FilterBuilder,
    TablePanel,
    TableModule,
    Tag,
    Message,
    ButtonDirective,
    RouterLink,
    RouteDrawer,
  ],
  providers: [MonitoringApi],
  templateUrl: './monitoring-page.html',
  styleUrl: './monitoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class MonitoringPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly branchName = input.required<string>();
  readonly language = input.required<Language>();
  readonly section = input.required<string>();
  private readonly api = inject(MonitoringApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clock = inject(WALL_CLOCK);
  private readonly now = signal(this.clock());
  readonly url = new UrlListState(monitoringDefinition);
  private readonly ready = new ReplaySubject<void>(1);
  protected readonly config = signal<AdminKarmaMonitoringSettingsQuery | null>(null);
  protected readonly configError = signal<unknown>(null);
  protected readonly trucks = signal<
    AdminKarmaMonitoringTrucksQuery['fleetKarmaMonitoringTrucks'] | null
  >(null);
  protected readonly events = signal<
    AdminKarmaMonitoringEventsQuery['fleetKarmaMonitoringEvents'] | null
  >(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<unknown>(null);
  private settingsQuery: ReturnType<MonitoringApi['settings']> | undefined;
  private truckQuery: ReturnType<MonitoringApi['trucks']> | undefined;
  private eventQuery: ReturnType<MonitoringApi['events']> | undefined;
  protected readonly text = computed(() => monitoringText(this.language()));
  protected readonly conditions = computed(() =>
    monitoringConditions(this.url.state(), this.section() === 'trucks'),
  );
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly failure = computed(() => requestError(this.error(), this.text().loadError));
  protected readonly settingsFailure = computed(() =>
    requestError(this.configError(), this.text().loadError),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows:
        this.section() === 'trucks'
          ? (this.trucks()?.items.length ?? null)
          : (this.events()?.items.length ?? null),
      filtered: !!this.url.state().search || this.conditions().length > 0,
    }),
  );
  protected readonly total = computed(() =>
    this.section() === 'trucks' ? (this.trucks()?.total ?? 0) : (this.events()?.total ?? 0),
  );
  protected readonly page = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.total(),
  }));
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const t = this.text();
    return this.section() === 'trucks'
      ? [
          {
            key: 'online',
            label: t.onlineFilter,
            type: 'boolean',
            operators: ['isTrue', 'isFalse'],
          },
          {
            key: 'withFaults',
            label: t.withFaults,
            type: 'boolean',
            operators: ['isTrue', 'isFalse'],
          },
        ]
      : [
          { key: 'truck', label: t.truckId, type: 'text', operators: ['equals'], maxLength: 32 },
          ...(this.section() === 'log'
            ? [
                {
                  key: 'kind',
                  label: t.kind,
                  type: 'enum' as const,
                  operators: ['isAnyOf' as const],
                  options: eventKinds.map((value) => ({ value, label: t.kinds[value] })),
                },
              ]
            : []),
          { key: 'from', label: t.from, type: 'date', operators: ['on'] },
          { key: 'to', label: t.to, type: 'date', operators: ['on'] },
        ];
  });
  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });
  protected readonly selected = computed(
    () => this.events()?.items.find((event) => `event-${event.id}` === this.fragment()) ?? null,
  );
  protected readonly actions = computed<
    readonly ListAction<
      'view',
      AdminKarmaMonitoringEventsQuery['fleetKarmaMonitoringEvents']['items'][number]
    >[]
  >(() => [{ id: 'view', label: this.text().details }]);
  protected readonly eventRecords = computed(
    () =>
      new Map(
        (this.events()?.items ?? []).map((event) => [
          event.id,
          listRecord(this.actions(), event, event.id, event.code ?? this.text().kinds[event.kind]),
        ]),
      ),
  );
  protected readonly raw = computed(() => {
    const raw = this.selected()?.rawRecord;
    if (!raw) {
      return '—';
    }
    try {
      const value: unknown = JSON.parse(raw);
      return JSON.stringify(value, null, 2);
    } catch {
      return raw;
    }
  });

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    this.loadSettings();
    const changes = combineLatest([this.url.changes, this.ready]);
    if (this.section() === 'trucks') {
      changes
        .pipe(
          switchMap(([state]) => {
            this.trucks.set(null);
            this.loading.set(true);
            this.error.set(null);
            this.truckQuery = this.api.trucks({
              offset: (state.page - 1) * state.pageSize,
              limit: state.pageSize,
              search: state.search,
              filter: { online: state.filter.online, withFaults: state.filter.withFaults },
            });
            return this.truckQuery.valueChanges.pipe(
              catchError((error: unknown) => {
                this.failed(error);
                return EMPTY;
              }),
            );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.trucks.set(result.data.fleetKarmaMonitoringTrucks);
            this.url.correctPage(
              Math.max(
                1,
                Math.ceil(result.data.fleetKarmaMonitoringTrucks.total / this.url.state().pageSize),
              ),
            );
          }
        });
    } else {
      changes
        .pipe(
          switchMap(([state]) => {
            this.events.set(null);
            this.loading.set(true);
            this.error.set(null);
            const zone = this.config()?.fleetSettings.timeZone ?? 'UTC';
            this.eventQuery = this.api.events({
              offset: (state.page - 1) * state.pageSize,
              limit: state.pageSize,
              search: state.search,
              filter: {
                karmaCarId: state.filter.truck,
                kinds:
                  this.section() === 'faults'
                    ? ['FAULT_REPORTED']
                    : state.filter.kind
                      ? [...state.filter.kind]
                      : undefined,
                from: dayBoundary(state.filter.from, zone),
                to: dayBoundary(state.filter.to, zone, true),
              },
            });
            return this.eventQuery.valueChanges.pipe(
              catchError((error: unknown) => {
                this.failed(error);
                return EMPTY;
              }),
            );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.events.set(result.data.fleetKarmaMonitoringEvents);
            this.url.correctPage(
              Math.max(
                1,
                Math.ceil(result.data.fleetKarmaMonitoringEvents.total / this.url.state().pageSize),
              ),
            );
          }
        });
    }
    fromEvent(document, 'visibilitychange')
      .pipe(
        startWith(null),
        switchMap(() => (document.visibilityState === 'visible' ? timer(60_000, 60_000) : EMPTY)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.refresh();
      });
  }
  protected loadSettings(): void {
    this.configError.set(null);
    this.settingsQuery = this.api.settings();
    this.settingsQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.configError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          const initial = this.config() === null;
          this.config.set(result.data);
          if (initial) {
            this.ready.next();
          }
        }
      },
      error: (error: unknown) => {
        this.configError.set(error);
      },
    });
  }
  private failed(error: unknown): void {
    this.error.set(error);
    this.loading.set(false);
  }
  protected refresh(): void {
    this.now.set(this.clock());
    if (this.config() === null) {
      this.loadSettings();
      return;
    }
    const query = this.section() === 'trucks' ? this.truckQuery : this.eventQuery;
    void query?.refetch().catch((error: unknown) => {
      this.failed(error);
    });
    void this.settingsQuery?.refetch().catch((error: unknown) => {
      this.configError.set(error);
    });
  }
  protected filter(conditions: readonly FilterCondition[]): void {
    this.url.patchFilter(monitoringFilter(conditions));
  }
  protected open(request: ListActionRequest<'view'>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      fragment: `event-${request.ids[0] ?? ''}`,
    });
  }
  protected close(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'preserve' });
  }
  protected time(value: string | null): string {
    return formatDateTime(
      value,
      this.language(),
      this.config()?.fleetSettings.timeZone ?? 'UTC',
      true,
    );
  }
  protected relative(value: string | null): string {
    return formatRelative(value, this.now(), this.language());
  }
  protected number(value: number | null | undefined): string {
    return formatNumber(value, this.language());
  }
  protected outcome(value: FleetKarmaMonitoringCommandOutcome | null): string {
    return value ? this.text().outcomes[value] : '—';
  }
  protected kind(value: FleetKarmaMonitoringEventKind): string {
    return this.text().kinds[value];
  }
  protected source(value: FleetKarmaMonitoringSource): string {
    return this.text().sources[value];
  }
  protected faultStatus(value: string | null): string {
    const known = Object.entries(this.text().statuses).find(([key]) => key === value);
    return known?.[1] ?? value ?? '—';
  }
  protected diagnosticLink(id: string): string[] {
    return ['/', this.language(), 'karma-client', 'cars', id, 'diagnostics'];
  }
}
