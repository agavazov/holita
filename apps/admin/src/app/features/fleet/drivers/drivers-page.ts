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
import { Message } from 'primeng/message';
import { ButtonDirective } from 'primeng/button';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDriversQuery,
  AdminDriverSummaryQuery,
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
import { driverRow } from './driver-mapping';
import {
  driverDefinition,
  driverQueryState,
  driverVariables,
  driverViewQuery,
} from './driver-query';
import { DriversApi } from './drivers-api';
import { DriversView, type DriverActionId, type DriverKpis } from './drivers-view';
import { driversText } from './i18n/messages';

@Component({
  selector: 'holita-drivers-page',
  providers: [DriversApi],
  imports: [DriversView, RouterOutlet, Message, ButtonDirective],
  templateUrl: './drivers-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriversPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(DriversApi);
  readonly url = new UrlListState(driverDefinition);
  readonly businessDate = signal<string | null>(null);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private query: ReturnType<DriversApi['watch']> | undefined;
  private summaryQuery: ReturnType<DriversApi['watchSummary']> | undefined;
  readonly page = signal<AdminDriversQuery['fleetDrivers'] | null>(null);
  readonly summary = signal<AdminDriverSummaryQuery['fleetDriverSummary'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly summaryError = signal<unknown>(null);
  readonly selected = signal<readonly ListRecord<DriverActionId>[]>([]);
  readonly acting = signal(false);
  private readonly removed = signal<ReadonlySet<string>>(new Set());
  protected readonly text = computed(() => driversText(this.language()));
  protected readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly summaryFailure = computed(() =>
    requestError(this.summaryError(), messages[this.language()].networkError),
  );
  protected readonly state = computed(() => ({
    ...driverViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).filter((row) => !this.removed().has(row.id)).map(driverRow),
  );
  protected readonly total = computed(() =>
    Math.max(0, (this.page()?.total ?? 0) - this.removed().size),
  );
  protected readonly kpis = computed<DriverKpis | null>(() => {
    const value = this.summary();
    return value
      ? {
          active: value.active,
          onLeave: value.onLeave,
          documents: value.documentsExpiring,
          averageScore: value.averageDrivingScore,
          distanceKm: value.distance30dKm,
        }
      : null;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(driverViewQuery(this.url.state())),
    }),
  );
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (!this.destroyRef.destroyed) {
        this.notifications.add({ severity: 'success', summary: message, life: 5000 });
        this.refresh();
      }
    },
  };

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.summaryQuery = this.api.watchSummary();
    this.summaryQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.summaryError.set(result.error ?? null);
        if (result.error) {
          this.businessDate.set(null);
        }
        if (result.dataState === 'complete' && !result.error) {
          this.summary.set(result.data.fleetDriverSummary);
          this.businessDate.set(result.data.fleetDataClock.businessDate);
        }
      },
      error: (error: unknown) => {
        this.summaryError.set(error);
        this.businessDate.set(null);
      },
    });
    this.url.changes
      .pipe(
        switchMap((query) => {
          this.page.set(null);
          this.removed.set(new Set());
          this.selected.set([]);
          this.loading.set(true);
          this.error.set(null);
          this.query = this.api.watch(driverVariables(query));
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
        if (result.dataState !== 'complete' || result.error || result.loading) {
          return;
        }
        this.acceptPage(result.data.fleetDrivers);
      });
  }

  changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = driverQueryState(query);
    const same = sameListState(
      { ...next, search: applied.search, page: applied.page },
      applied,
      driverDefinition,
    );
    if (query.search !== this.url.searchDraft() && same) {
      this.url.editSearch(query.search);
    } else {
      const search = searchApplies(query.search) ? normalizeSearch(query.search) : applied.search;
      const page =
        query.pageSize === applied.pageSize && search === applied.search ? query.page : 1;
      this.url.setState({ ...next, search, page });
    }
  }

  open(id: string | null, mode: 'view' | 'edit' | 'scorecard' = 'edit'): void {
    if (this.acting()) {
      return;
    }
    this.url.cancelPending();
    this.url.searchDraft.set(this.url.state().search);
    const commands = id === null ? ['new'] : mode === 'view' ? [id] : [id, mode];
    void this.router.navigate(commands, {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  async run({ action, ids }: ListActionRequest<DriverActionId>): Promise<void> {
    if (this.acting() || !this.isCurrent()) {
      return;
    }
    const [id] = ids;
    if (action === 'view' || action === 'edit' || action === 'scorecard') {
      if (id) {
        this.open(id, action);
      }
      return;
    }
    if (!ids.length) {
      return;
    }
    this.acting.set(true);
    const labels = new Map(
      (this.page()?.items ?? []).map((row) => [row.id, `${row.firstName} ${row.lastName}`]),
    );
    try {
      const result =
        action === 'delete' ? await this.api.deleteMany(ids) : await this.api.deactivateMany(ids);
      if (this.destroyRef.destroyed) {
        return;
      }
      const successes = new Set(result.succeededIds);
      this.selected.update((records) => records.filter((record) => !successes.has(record.id)));
      if (action === 'delete') {
        const visible = new Set(this.page()?.items.map((row) => row.id));
        this.removed.update(
          (removed) =>
            new Set([...removed, ...result.succeededIds.filter((id) => visible.has(id))]),
        );
      } else {
        this.page.update((page) =>
          page
            ? {
                ...page,
                items: page.items.map((row) =>
                  successes.has(row.id) ? { ...row, status: 'INACTIVE' } : row,
                ),
              }
            : null,
        );
      }
      const summary = interpolate(
        action === 'delete' ? this.text().notices.deleted : this.text().notices.deactivated,
        { count: successes.size },
      );
      this.notifications.add({
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
        this.notifications.add({
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
          this.acceptPage(result.data.fleetDrivers);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed && this.query === query) {
          this.error.set(error);
          this.loading.set(false);
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
        if (result.error) {
          this.businessDate.set(null);
        }
        if (result.data && !result.error) {
          this.summary.set(result.data.fleetDriverSummary);
          this.businessDate.set(result.data.fleetDataClock.businessDate);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.summaryError.set(error);
          this.businessDate.set(null);
        }
      });
  }

  private acceptPage(page: AdminDriversQuery['fleetDrivers']): void {
    this.page.set(page);
    this.removed.set(new Set());
    const visible = new Set(page.items.map((row) => row.id));
    this.selected.update((records) => records.filter((record) => visible.has(record.id)));
    this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
  }
}
