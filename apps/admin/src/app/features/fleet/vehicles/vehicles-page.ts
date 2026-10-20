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
  AdminVehiclesQuery,
  AdminVehicleSummaryQuery,
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
import { VehicleChoices } from './vehicle-choices';
import { vehicleRow } from './vehicle-mapping';
import {
  vehicleDefinition,
  vehicleQueryState,
  vehicleVariables,
  vehicleViewQuery,
} from './vehicle-query';
import { VehiclesApi } from './vehicles-api';
import { VehiclesView, type VehicleActionId } from './vehicles-view';
import { vehiclesText } from './i18n/messages';

@Component({
  selector: 'holita-vehicles-page',
  providers: [VehiclesApi, VehicleChoices],
  imports: [VehiclesView, RouterOutlet, Message, ButtonDirective],
  templateUrl: './vehicles-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(VehiclesApi);
  readonly choices = inject(VehicleChoices);
  readonly url = new UrlListState(vehicleDefinition);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private query: ReturnType<VehiclesApi['watch']> | undefined;
  private summaryQuery: ReturnType<VehiclesApi['watchSummary']> | undefined;
  readonly page = signal<AdminVehiclesQuery['fleetVehicles'] | null>(null);
  readonly summary = signal<AdminVehicleSummaryQuery['fleetVehicleSummary'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly summaryError = signal<unknown>(null);
  readonly selected = signal<readonly ListRecord<VehicleActionId>[]>([]);
  readonly acting = signal(false);
  private readonly removed = signal<ReadonlySet<string>>(new Set());
  protected readonly text = computed(() => vehiclesText(this.language()));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly summaryFailure = computed(() =>
    requestError(this.summaryError(), messages[this.language()].networkError),
  );
  protected readonly choicesFailure = computed(() =>
    requestError(this.choices.error(), messages[this.language()].networkError),
  );
  protected readonly state = computed(() => ({
    ...vehicleViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).filter((vehicle) => !this.removed().has(vehicle.id)).map(vehicleRow),
  );
  protected readonly total = computed(() =>
    Math.max(0, (this.page()?.total ?? 0) - this.removed().size),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(vehicleViewQuery(this.url.state())),
    }),
  );
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (this.destroyRef.destroyed) {
        return;
      }
      this.notifications.add({ severity: 'success', summary: message, life: 5000 });
      this.refresh();
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
          this.summary.set(result.data.fleetVehicleSummary);
        }
      },
      error: (error: unknown) => {
        this.summaryError.set(error);
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
          this.query = this.api.watch(vehicleVariables(query));
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
        this.page.set(result.data.fleetVehicles);
        this.removed.set(new Set());
        const ids = new Set(result.data.fleetVehicles.items.map((vehicle) => vehicle.id));
        this.selected.update((records) => records.filter((record) => ids.has(record.id)));
        const lastPage = Math.max(
          1,
          Math.ceil(result.data.fleetVehicles.total / this.url.state().pageSize),
        );
        this.url.correctPage(lastPage);
      });
  }

  changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = vehicleQueryState(query);
    const sameFiltersAndSort = sameListState(
      { ...next, search: applied.search, page: applied.page },
      applied,
      vehicleDefinition,
    );
    if (query.search !== this.url.searchDraft() && sameFiltersAndSort) {
      this.url.editSearch(query.search);
    } else {
      const search = searchApplies(query.search) ? normalizeSearch(query.search) : applied.search;
      const page =
        query.pageSize === applied.pageSize && search === applied.search ? query.page : 1;
      this.url.setState({ ...next, search, page });
    }
  }

  openEditor(id: string | null): void {
    if (this.acting()) {
      return;
    }
    this.url.cancelPending();
    this.url.searchDraft.set(this.url.state().search);
    void this.router.navigate(id ? [id, 'edit'] : ['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  async run({ action, ids }: ListActionRequest<VehicleActionId>): Promise<void> {
    if (this.acting() || !this.isCurrent()) {
      return;
    }
    const [id] = ids;
    if (action === 'edit') {
      if (id) {
        this.openEditor(id);
      }
      return;
    }
    if (action === 'profile') {
      if (id) {
        this.url.cancelPending();
        this.url.searchDraft.set(this.url.state().search);
        void this.router.navigate([id, 'overview'], {
          relativeTo: this.route,
          queryParamsHandling: 'preserve',
          preserveFragment: true,
        });
      }
      return;
    }
    if (!ids.length) {
      return;
    }
    this.acting.set(true);
    const labels = new Map(
      (this.page()?.items ?? []).map((vehicle) => [vehicle.id, vehicle.licensePlate]),
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
        const visible = new Set(this.page()?.items.map((vehicle) => vehicle.id));
        this.removed.update(
          (removed) =>
            new Set([...removed, ...result.succeededIds.filter((id) => visible.has(id))]),
        );
      } else {
        this.page.update((page) =>
          page
            ? {
                ...page,
                items: page.items.map((vehicle) =>
                  successes.has(vehicle.id)
                    ? { ...vehicle, status: 'INACTIVE', currentDriverId: null, currentDriver: null }
                    : vehicle,
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
          this.page.set(result.data.fleetVehicles);
          this.removed.set(new Set());
          const visible = new Set(result.data.fleetVehicles.items.map((vehicle) => vehicle.id));
          this.selected.update((records) => records.filter((record) => visible.has(record.id)));
          this.url.correctPage(
            Math.max(1, Math.ceil(result.data.fleetVehicles.total / this.url.state().pageSize)),
          );
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

  refreshSummary(): void {
    void this.summaryQuery
      ?.refetch()
      .then((result) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.summaryError.set(result.error ?? null);
        if (result.data && !result.error) {
          this.summary.set(result.data.fleetVehicleSummary);
        }
      })
      .catch((error: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.summaryError.set(error);
        }
      });
  }

  private isCurrent(): boolean {
    return !this.destroyRef.destroyed;
  }
}
