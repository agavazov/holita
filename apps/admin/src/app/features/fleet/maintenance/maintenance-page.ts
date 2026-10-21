import { fleetRecordLinks } from '../fleet-record-links';
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
  AdminBranchesQuery,
  AdminServiceTasksQuery,
  AdminServiceSummaryQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { interpolate, uiMessages } from '../../../ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../ui/list/list-actions';
import { listQuery, type ListQuery } from '../../../ui/list/list-query';
import { normalizeSearch, sameListState, searchApplies } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { tableView } from '../../../ui/table-panel/table-view';
import { maintenanceText } from './i18n/messages';
import { MaintenanceApi } from './maintenance-api';
import { MaintenanceChoices } from './maintenance-choices';
import {
  maintenanceDefinition,
  maintenanceQueryState,
  maintenanceVariables,
  maintenanceViewQuery,
} from './maintenance-query';
import { MaintenanceView, type MaintenanceActionId } from './maintenance-view';
import { maintenanceKpis, serviceTaskRow } from './service-task-mapping';
@Component({
  selector: 'holita-maintenance-page',
  providers: [MaintenanceApi, MaintenanceChoices],
  imports: [MaintenanceView, RouterOutlet, Message, ButtonDirective],
  template: `
    @if (summaryError()) {
      <p-message severity="warn"
        >{{ summaryFailure() }}
        <button pButton type="button" severity="secondary" (click)="refreshSummary()">
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
    <holita-maintenance-view
      [recordLinks]="recordLinks()"
      [branchName]="branch().name"
      [rows]="rows()"
      [total]="total()"
      [view]="view()"
      [state]="state()"
      [kpis]="kpis()"
      [vehicles]="choices.vehicles()"
      [selection]="selected()"
      [busy]="loading() || acting()"
      [searchError]="searchError()"
      [errorText]="failure()"
      (stateChange)="changeState($event)"
      (create)="openRecord(null)"
      (action)="run($event)"
      (selectionChange)="selected.set($event)"
      (retry)="refresh()"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenancePage implements OnInit {
  protected readonly recordLinks = computed(() =>
    fleetRecordLinks(this.language(), this.branch().id),
  );
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(MaintenanceApi);
  readonly choices = inject(MaintenanceChoices);
  readonly url = new UrlListState(maintenanceDefinition);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notices = inject(MessageService);
  private query: ReturnType<MaintenanceApi['watch']> | undefined;
  private summaryQuery: ReturnType<MaintenanceApi['watchSummary']> | undefined;
  readonly page = signal<AdminServiceTasksQuery['fleetServiceTasks'] | null>(null);
  readonly summary = signal<AdminServiceSummaryQuery['fleetServiceSummary'] | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<unknown>(null);
  readonly summaryError = signal<unknown>(null);
  readonly selected = signal<readonly ListRecord<MaintenanceActionId>[]>([]);
  private readonly removed = signal<ReadonlySet<string>>(new Set());
  private readonly text = computed(() => maintenanceText(this.language()));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly summaryFailure = computed(() =>
    requestError(this.summaryError(), messages[this.language()].networkError),
  );
  protected readonly choicesFailure = computed(() =>
    requestError(this.choices.error(), messages[this.language()].networkError),
  );
  protected readonly retryText = computed(() => uiMessages[this.language()].retry);
  protected readonly rows = computed(() =>
    (this.page()?.items ?? [])
      .filter((task) => !this.removed().has(task.id))
      .map((task) => serviceTaskRow(task, this.language())),
  );
  protected readonly total = computed(() =>
    Math.max(0, (this.page()?.total ?? 0) - this.removed().size),
  );
  protected readonly kpis = computed(() => {
    const summary = this.summary();
    return summary ? maintenanceKpis(summary) : null;
  });
  protected readonly state = computed(() => ({
    ...maintenanceViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(maintenanceViewQuery(this.url.state())),
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
    this.summaryQuery = this.api.watchSummary();
    this.summaryQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.summaryError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.summary.set(result.data.fleetServiceSummary);
        }
      },
      error: (error: unknown) => {
        this.summaryError.set(error);
      },
    });
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.page.set(null);
          this.removed.set(new Set());
          this.selected.set([]);
          this.loading.set(true);
          this.error.set(null);
          this.query = this.api.watch(maintenanceVariables(state, this.language()));
          return this.query.valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
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
          this.acceptPage(result.data.fleetServiceTasks);
        }
      });
  }
  private acceptPage(page: AdminServiceTasksQuery['fleetServiceTasks']): void {
    this.page.set(page);
    this.removed.set(new Set());
    const ids = new Set(page.items.map((task) => task.id));
    this.selected.update((records) => records.filter((record) => ids.has(record.id)));
    this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
  }
  changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = maintenanceQueryState(query);
    const same = sameListState(
      { ...next, search: applied.search, page: applied.page },
      applied,
      maintenanceDefinition,
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
  openRecord(id: string | null, action: 'edit' | 'complete' | 'view' = 'edit'): void {
    if (this.acting()) {
      return;
    }
    this.url.cancelPending();
    this.url.searchDraft.set(this.url.state().search);
    void this.router.navigate(id ? (action === 'view' ? [id] : [id, action]) : ['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
  async run({ action, ids }: ListActionRequest<MaintenanceActionId>): Promise<void> {
    const [id] = ids;
    if (!id || this.acting() || !this.isCurrent()) {
      return;
    }
    if (action === 'edit' || action === 'complete' || action === 'view') {
      this.openRecord(id, action);
      return;
    }
    if (action === 'vehicle') {
      const task = this.page()?.items.find((task) => task.id === id);
      if (task) {
        void this.router.navigate([
          '/',
          this.language(),
          this.branch().id,
          'fleet',
          'vehicles',
          task.vehicleId,
          'overview',
        ]);
      }
      return;
    }
    this.acting.set(true);
    const labels = new Map(this.rows().map((row) => [row.id, `${row.kind} · ${row.plate}`]));
    try {
      const result = await this.api.act(action, ids);
      if (this.destroyRef.destroyed) {
        return;
      }
      const successes = new Set(result.succeededIds);
      this.selected.update((records) => records.filter((record) => !successes.has(record.id)));
      if (action === 'delete') {
        const visible = new Set(this.page()?.items.map((task) => task.id));
        this.removed.update(
          (removed) =>
            new Set([...removed, ...result.succeededIds.filter((id) => visible.has(id))]),
        );
      } else {
        this.page.update((page) =>
          page
            ? {
                ...page,
                items: page.items.map((task) =>
                  successes.has(task.id)
                    ? {
                        ...task,
                        status: 'CANCELLED',
                        urgency: null,
                        remainingDays: null,
                        remainingKm: null,
                      }
                    : task,
                ),
              }
            : null,
        );
      }
      const summary = interpolate(
        action === 'delete' ? this.text().notices.deleted : this.text().notices.cancelled,
        { count: successes.size },
      );
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
      if (!this.destroyRef.destroyed) {
        this.notices.add({
          severity: 'error',
          summary: requestError(error, messages[this.language()].networkError),
          sticky: true,
        });
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.acting.set(false);
      }
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
        if (this.destroyRef.destroyed || this.query !== query) {
          return;
        }
        this.loading.set(false);
        this.error.set(result.error ?? null);
        if (result.data && !result.error) {
          this.acceptPage(result.data.fleetServiceTasks);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.loading.set(false);
          this.error.set(error);
        }
      });
    this.refreshSummary();
  }

  private isCurrent(): boolean {
    return !this.destroyRef.destroyed;
  }
  refreshSummary(): void {
    void this.summaryQuery
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.summaryError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.summary.set(result.data.fleetServiceSummary);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.summaryError.set(error);
        }
      });
  }
}
