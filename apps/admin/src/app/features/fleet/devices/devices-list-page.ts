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
import { Message } from 'primeng/message';
import { ButtonDirective } from 'primeng/button';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDevicesQuery,
  AdminDeviceSummaryQuery,
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
import { deviceRow } from './device-mapping';
import {
  deviceDefinition,
  deviceModels,
  deviceQueryState,
  deviceVariables,
  deviceViewQuery,
} from './device-query';
import { DevicesApi } from './devices-api';
import { DevicesView, type DeviceActionId } from './devices-view';
import { devicesText } from './i18n/messages';

@Component({
  selector: 'holita-devices-list-page',
  providers: [DevicesApi],
  imports: [DevicesView, RouterOutlet, Message, ButtonDirective],
  template: `
    @if (summaryError()) {
      <p-message severity="warn"
        >{{ summaryFailure() }}
        <button pButton type="button" (click)="refreshSummary()">{{ text().drawer.retry }}</button>
      </p-message>
    }
    <holita-devices-view
      [recordLinks]="recordLinks()"
      [branchName]="branch().name"
      [dataAsOf]="summary()?.dataAsOf ?? ''"
      [rows]="rows()"
      [total]="total()"
      [view]="view()"
      [state]="state()"
      [kpis]="kpis()"
      [models]="models"
      [selection]="selected()"
      [busy]="acting() || loading()"
      [searchError]="searchError()"
      [errorText]="failure()"
      (stateChange)="changeState($event)"
      (create)="open(null)"
      (action)="run($event)"
      (selectionChange)="selected.set($event)"
      (retry)="refresh()"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesPage implements OnInit {
  protected readonly recordLinks = computed(() =>
    fleetRecordLinks(this.language(), this.branch().id),
  );
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(DevicesApi);
  readonly url = new UrlListState(deviceDefinition);
  readonly models = deviceModels;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private query: ReturnType<DevicesApi['watch']> | undefined;
  private summaryQuery: ReturnType<DevicesApi['watchSummary']> | undefined;
  readonly page = signal<AdminDevicesQuery['fleetDevices'] | null>(null);
  readonly summary = signal<AdminDeviceSummaryQuery['fleetDeviceSummary'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly summaryError = signal<unknown>(null);
  readonly selected = signal<readonly ListRecord<DeviceActionId>[]>([]);
  readonly acting = signal(false);
  private readonly removed = signal<ReadonlySet<string>>(new Set());
  protected readonly text = computed(() => devicesText(this.language()));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly summaryFailure = computed(() =>
    requestError(this.summaryError(), messages[this.language()].networkError),
  );
  protected readonly state = computed(() => ({
    ...deviceViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const key = this.url.searchError();
    return key ? uiMessages[this.language()][key] : null;
  });
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).filter((device) => !this.removed().has(device.id)).map(deviceRow),
  );
  protected readonly total = computed(() =>
    Math.max(0, (this.page()?.total ?? 0) - this.removed().size),
  );
  protected readonly kpis = computed(() => {
    const summary = this.summary();
    return summary
      ? { online: summary.online, offline: summary.offline, stock: summary.inStock, outdated: null }
      : null;
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() ? this.rows().length : null,
      filtered: listQuery.filtered(deviceViewQuery(this.url.state())),
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
    this.summaryQuery = this.api.watchSummary();
    this.summaryQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.summaryError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.summary.set(result.data.fleetDeviceSummary);
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
          this.query = this.api.watch(deviceVariables(query));
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
        this.page.set(result.data.fleetDevices);
        this.removed.set(new Set());
        const visible = new Set(result.data.fleetDevices.items.map((device) => device.id));
        this.selected.update((records) => records.filter((record) => visible.has(record.id)));
        this.url.correctPage(
          Math.max(1, Math.ceil(result.data.fleetDevices.total / this.url.state().pageSize)),
        );
      });
  }

  changeState(query: ListQuery): void {
    const applied = this.url.state(),
      next = deviceQueryState(query);
    if (
      query.search !== this.url.searchDraft() &&
      sameListState(
        { ...next, search: applied.search, page: applied.page },
        applied,
        deviceDefinition,
      )
    ) {
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

  open(id: string | null, section: 'edit' | 'diagnostics' = 'edit'): void {
    if (this.acting()) {
      return;
    }
    this.url.cancelPending();
    this.url.searchDraft.set(this.url.state().search);
    void this.router.navigate(id ? [id, section] : ['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  async run({ action, ids }: ListActionRequest<DeviceActionId>): Promise<void> {
    if (this.acting() || !this.isCurrent()) {
      return;
    }
    const [id] = ids;
    if (action === 'edit' || action === 'diagnostics') {
      if (id) {
        this.open(id, action);
      }
      return;
    }
    if (action === 'vehicle') {
      const device = this.page()?.items.find((record) => record.id === id);
      if (device?.vehicleId) {
        void this.router.navigate([
          '/',
          this.language(),
          this.branch().id,
          'fleet',
          'vehicles',
          device.vehicleId,
          'overview',
        ]);
      }
      return;
    }
    if (action !== 'delete' || !ids.length) {
      return;
    }
    this.acting.set(true);
    const labels = new Map((this.page()?.items ?? []).map((device) => [device.id, device.imei]));
    try {
      const result = await this.api.deleteMany(ids);
      if (this.destroyRef.destroyed) {
        return;
      }
      const successes = new Set(result.succeededIds);
      this.selected.update((records) => records.filter((record) => !successes.has(record.id)));
      const visible = new Set(this.page()?.items.map((device) => device.id));
      this.removed.update(
        (removed) => new Set([...removed, ...result.succeededIds.filter((id) => visible.has(id))]),
      );
      const summary = interpolate(this.text().notices.deleted, { count: successes.size });
      this.notifications.add({
        severity: result.failures.length ? 'warn' : 'success',
        summary: result.failures.length
          ? summary +
            ' ' +
            interpolate(this.text().notices.partialFailure, { count: result.failures.length })
          : summary,
        ...(result.failures.length
          ? {
              detail: result.failures
                .map((failure) => (labels.get(failure.id) ?? failure.id) + ': ' + failure.message)
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
          this.page.set(result.data.fleetDevices);
          this.removed.set(new Set());
          const visible = new Set(result.data.fleetDevices.items.map((device) => device.id));
          this.selected.update((records) => records.filter((record) => visible.has(record.id)));
          this.url.correctPage(
            Math.max(1, Math.ceil(result.data.fleetDevices.total / this.url.state().pageSize)),
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
          this.summary.set(result.data.fleetDeviceSummary);
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
