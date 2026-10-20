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
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type {
  AdminAlertCountsQuery,
  AdminAlertsQuery,
  AdminBranchesQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { interpolate, uiMessages } from '../../../ui/i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import type { ListActionRequest, ListRecord } from '../../../ui/list/list-actions';
import { listQuery, type ListQuery } from '../../../ui/list/list-query';
import { normalizeSearch, sameListState, searchApplies } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { tableView } from '../../../ui/table-panel/table-view';
import { alertRow } from './alert-mapping';
import { alertDefinition, alertQueryState, alertVariables, alertViewQuery } from './alert-query';
import { AlertChoices } from './alert-choices';
import { AlertsApi } from './alerts-api';
import { AlertsView, type AlertActionId, type AlertKpis } from './alerts-view';
import { alertsText } from './i18n/messages';

@Component({
  selector: 'holita-alerts-page',
  providers: [AlertsApi, AlertChoices],
  imports: [AlertsView, RouterOutlet, Message, ButtonDirective],
  template: `
    @if (countsError()) {
      <p-message severity="warn"
        >{{ countsFailure() }}
        <button pButton type="button" severity="secondary" (click)="refreshCounts()">
          {{ retryText() }}
        </button></p-message
      >
    }
    @if (clockError()) {
      <p-message severity="warn"
        >{{ clockFailure() }}
        <button pButton type="button" severity="secondary" (click)="refreshClock()">
          {{ retryText() }}
        </button></p-message
      >
    }
    @if (choices.error()) {
      <p-message severity="warn"
        >{{ choicesFailure() }}
        <button pButton type="button" severity="secondary" (click)="choices.load()">
          {{ retryText() }}
        </button></p-message
      >
    }
    <holita-alerts-view
      [branchName]="branch().name"
      [dataAsOf]="dataAsOf() ?? ''"
      [rows]="rows()"
      [total]="page()?.total ?? 0"
      [view]="view()"
      [state]="state()"
      [kpis]="kpis()"
      [vehicles]="choices.vehicles()"
      [selection]="selected()"
      [busy]="loading() || acting()"
      [searchError]="searchError()"
      [errorText]="failure()"
      (stateChange)="changeState($event)"
      (action)="run($event)"
      (selectionChange)="selected.set($event)"
      (retry)="refresh()"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(AlertsApi);
  readonly choices = inject(AlertChoices);
  readonly url = new UrlListState(alertDefinition);
  private readonly units = injectFleetFormat();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notices = inject(MessageService);
  private query: ReturnType<AlertsApi['watch']> | undefined;
  private countsQuery: ReturnType<AlertsApi['watchCounts']> | undefined;
  private clockQuery: ReturnType<AlertsApi['watchClock']> | undefined;
  readonly page = signal<AdminAlertsQuery['fleetEvents'] | null>(null);
  readonly counts = signal<AdminAlertCountsQuery['fleetAlertCounts'] | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<unknown>(null);
  readonly countsError = signal<unknown>(null);
  readonly clockError = signal<unknown>(null);
  readonly dataAsOf = signal<string | null>(null);
  readonly selected = signal<readonly ListRecord<AlertActionId>[]>([]);
  private readonly text = computed(() => alertsText(this.language()));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly countsFailure = computed(() =>
    requestError(this.countsError(), messages[this.language()].networkError),
  );
  protected readonly clockFailure = computed(() =>
    requestError(this.clockError(), messages[this.language()].networkError),
  );
  protected readonly choicesFailure = computed(() =>
    requestError(this.choices.error(), messages[this.language()].networkError),
  );
  protected readonly retryText = computed(() => uiMessages[this.language()].retry);
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).flatMap((event) => {
      const row = alertRow(event, this.language());
      return row ? [row] : [];
    }),
  );
  protected readonly state = computed(() => ({
    ...alertViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly kpis = computed<AlertKpis | null>(() => {
    const counts = this.counts();
    return counts
      ? {
          critical: counts.openCritical,
          open: counts.open,
          acknowledged: counts.acknowledged,
          resolved: counts.resolved,
        }
      : null;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(alertViewQuery(this.url.state())),
    }),
  );
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (!this.destroyRef.destroyed) {
        this.notices.add({ severity: 'success', summary: message, life: 5000 });
        this.refresh();
      }
    },
  };

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.choices.load();
    this.clockQuery = this.api.watchClock();
    this.clockQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.clockError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.dataAsOf.set(result.data.fleetDataClock.asOf);
        }
      },
      error: (error: unknown) => {
        this.clockError.set(error);
      },
    });
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.page.set(null);
          this.selected.set([]);
          this.loading.set(true);
          this.error.set(null);
          this.query = this.api.watch(alertVariables(state, this.units.preferences().timeZone));
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
        if (result.dataState !== 'complete' || result.error || result.loading) {
          return;
        }
        this.acceptPage(result.data.fleetEvents);
      });
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.counts.set(null);
          this.countsError.set(null);
          const variables = alertVariables(state, this.units.preferences().timeZone);
          this.countsQuery = this.api.watchCounts({
            search: variables.search,
            filter: variables.filter,
          });
          return this.countsQuery.valueChanges.pipe(
            catchError((error: unknown) => {
              this.countsError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.countsError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.counts.set(result.data.fleetAlertCounts);
        }
      });
  }
  private acceptPage(page: AdminAlertsQuery['fleetEvents']): void {
    this.page.set(page);
    const ids = new Set(page.items.map((event) => event.id));
    this.selected.update((selected) => selected.filter((record) => ids.has(record.id)));
    this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
  }
  changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = alertQueryState(query);
    const same = sameListState(
      { ...next, search: applied.search, page: applied.page },
      applied,
      alertDefinition,
    );
    if (query.search !== this.url.searchDraft() && same) {
      this.url.editSearch(query.search);
    } else {
      const search = searchApplies(query.search) ? normalizeSearch(query.search) : applied.search;
      this.url.setState({
        ...next,
        search,
        page: query.pageSize === applied.pageSize && search === applied.search ? query.page : 1,
      });
    }
  }
  openAlert(id: string): void {
    this.url.cancelPending();
    this.url.searchDraft.set(this.url.state().search);
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
  async run({ action, ids }: ListActionRequest<AlertActionId>): Promise<void> {
    if (this.acting() || !this.current()) {
      return;
    }
    const [id] = ids;
    if (!id) {
      return;
    }
    if (action === 'open' || action === 'resolve') {
      this.openAlert(id);
      return;
    }
    if (action === 'vehicle') {
      const event = this.page()?.items.find((event) => event.id === id);
      if (event) {
        void this.router.navigate([
          '/',
          this.language(),
          this.branch().id,
          'fleet',
          'vehicles',
          event.vehicleId,
          'overview',
        ]);
      }
      return;
    }
    this.acting.set(true);
    const labels = new Map(this.rows().map((row) => [row.id, `${row.kind} · ${row.plate}`]));
    try {
      const result = await this.api.acknowledgeMany(ids);
      if (!this.current()) {
        return;
      }
      const successes = new Set(result.succeededIds);
      this.selected.update((records) => records.filter((record) => !successes.has(record.id)));
      this.page.update((page) =>
        page
          ? {
              ...page,
              items: page.items.map((event) =>
                successes.has(event.id) ? { ...event, alertStatus: 'ACKNOWLEDGED' } : event,
              ),
            }
          : null,
      );
      const summary = interpolate(this.text().notices.acknowledged, { count: successes.size });
      this.notices.add({
        severity: result.failures.length ? 'warn' : 'success',
        summary: result.failures.length
          ? `${summary} ${interpolate(this.text().notices.partialFailure, { count: result.failures.length })}`
          : summary,
        ...(result.failures.length
          ? {
              detail: result.failures
                .map((failure) => `${labels.get(failure.id) ?? failure.id}: ${failure.message}`)
                .join('\n'),
            }
          : {}),
        sticky: result.failures.length > 0,
        life: 5000,
      });
      this.refresh();
    } catch (error: unknown) {
      if (this.current()) {
        this.notices.add({
          severity: 'error',
          summary: requestError(error, messages[this.language()].networkError),
          sticky: true,
        });
      }
    } finally {
      if (this.current()) {
        this.acting.set(false);
      }
    }
  }
  private current(): boolean {
    return !this.destroyRef.destroyed;
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
        if (this.destroyRef.destroyed || this.query !== query) {
          return;
        }
        this.loading.set(false);
        this.error.set(result.error ?? null);
        if (result.data && !result.error) {
          this.acceptPage(result.data.fleetEvents);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.error.set(error);
          this.loading.set(false);
        }
      });
    this.refreshCounts();
    this.refreshClock();
  }
  refreshCounts(): void {
    const query = this.countsQuery;
    void query
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed || this.countsQuery !== query) {
          return;
        }
        this.countsError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.counts.set(result.data.fleetAlertCounts);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.countsQuery === query) {
          this.countsError.set(error);
        }
      });
  }
  refreshClock(): void {
    void this.clockQuery
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.clockError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.dataAsOf.set(result.data.fleetDataClock.asOf);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.clockError.set(error);
        }
      });
  }
}
