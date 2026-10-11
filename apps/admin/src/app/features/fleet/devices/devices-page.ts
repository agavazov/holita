import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  convertToParamMap,
  type ParamMap,
} from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import type {
  AdminDeviceFragment,
  AdminDevicesQuery,
  AdminStoresQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { DevicesApi } from './devices-api';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { InputText } from 'primeng/inputtext';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  deviceListQueryParams,
  deviceListVariables,
  devicePageSizes,
  readDeviceListQuery,
  sameDeviceListQuery,
  type DeviceListQuery,
} from './device-list-query';

@Component({
  selector: 'holita-devices-page',
  providers: [DevicesApi, ConfirmationService],
  imports: [
    FormsModule,
    RouterLink,
    ButtonDirective,
    TableModule,
    Message,
    InputText,
    Paginator,
    ConfirmDialog,
  ],
  templateUrl: './devices-page.html',
  styleUrl: '../fleet-list.scss',
})
export class DevicesPage implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly api = inject(DevicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly saved =
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.extras.state?.[
      'deviceSaved'
    ] === true;
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('devicesHeading');
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly listQuery = computed(() => readDeviceListQuery(this.params()));
  readonly selected = linkedSignal<DeviceListQuery, AdminDeviceFragment[]>({
    source: this.listQuery,
    computation: (query, previous) =>
      previous && sameDeviceListQuery(query, previous.source) ? previous.value : [],
  });
  readonly deleteProgress = signal<{ completed: number; total: number } | null>(null);
  readonly deleting = computed(() => this.deleteProgress() !== null);
  readonly deletionResult = signal<{
    deleted: number;
    failures: { device: AdminDeviceFragment; message: string }[];
  } | null>(null);
  readonly deletingMessage = computed(() => {
    const progress = this.deleteProgress();
    return progress
      ? this.text()
          .deletingDevices.replace('{completed}', String(progress.completed))
          .replace('{total}', String(progress.total))
      : '';
  });
  readonly deletionSummary = computed(() => {
    const result = this.deletionResult();
    if (!result) return '';
    return (
      this.text().devicesDeleted.replace('{count}', String(result.deleted)) +
      (result.failures.length
        ? ' ' + this.text().devicesDeleteFailed.replace('{count}', String(result.failures.length))
        : '')
    );
  });
  readonly search = linkedSignal(() => this.listQuery().search);
  readonly pageSizes = devicePageSizes;
  readonly sortField = computed(() => {
    const fields = {
      IMEI: 'imei',
      CREATED_AT: 'createdAt',
    };
    return fields[this.listQuery().sort];
  });
  readonly sortOrder = computed(() => (this.listQuery().order === 'ASC' ? 1 : -1));
  private readonly textEdits = new Subject<void>();
  private readonly cancelEdits = new Subject<void>();
  private readonly sortEdits = new Subject<Pick<DeviceListQuery, 'sort' | 'order'>>();
  private query: ReturnType<DevicesApi['watch']> | undefined;
  readonly page = signal<AdminDevicesQuery['fleetDevices'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly trackDevice = (_index: number, device: AdminDeviceFragment) => device.id;

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.textEdits
      .pipe(
        switchMap(() => timer(300).pipe(takeUntil(this.cancelEdits))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.applyFilters({}, true);
      });
    // Table also emits when controlled sort inputs change; coalesce those updates before comparing the URL.
    this.sortEdits
      .pipe(
        switchMap((sort) =>
          timer(0).pipe(
            takeUntil(this.cancelEdits),
            map(() => sort),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((sort) => {
        const current = this.listQuery();
        if (sort.sort !== current.sort || sort.order !== current.order) this.applyFilters(sort);
      });
    this.route.queryParamMap
      .pipe(
        tap((params) => {
          this.cancelEdits.next();
          this.normalizeUrl(params);
        }),
        map(readDeviceListQuery),
        distinctUntilChanged(sameDeviceListQuery),
        switchMap((params) => {
          this.confirmation.close();
          this.deleteProgress.set(null);
          this.page.set(null);
          this.error.set(null);
          this.loading.set(true);
          const query = this.api.watch(deviceListVariables(params));
          this.query = query;
          return query.valueChanges.pipe(
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
        if (
          result.dataState === 'complete' &&
          !result.error &&
          !(this.deleting() && result.loading)
        ) {
          const devices = result.data.fleetDevices;
          const current = this.listQuery();
          const lastPage = Math.max(1, Math.ceil(devices.total / current.pageSize));
          if (current.page > lastPage) {
            // Cached totals may be stale; wait for a successful network result before correcting the URL.
            if (!result.loading) this.navigate({ ...current, page: lastPage }, true);
          } else {
            this.page.set(devices);
            const selectedIds = new Set(this.selected().map((device) => device.id));
            this.selected.set(devices.items.filter((device) => selectedIds.has(device.id)));
          }
        }
      });
  }

  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed && this.query === query) this.error.set(error);
    });
  }

  selectDevices(value: unknown): void {
    if (this.deleting() || !Array.isArray(value)) return;
    const ids = new Set(
      value.flatMap((device: unknown) =>
        typeof device === 'object' &&
        device !== null &&
        'id' in device &&
        typeof device.id === 'string'
          ? [device.id]
          : [],
      ),
    );
    this.selected.set(this.page()?.items.filter((device) => ids.has(device.id)) ?? []);
  }

  confirmDelete(devices: readonly AdminDeviceFragment[], event: Event): void {
    const query = this.query;
    if (this.deleting() || !query || devices.length === 0) return;
    const targets = [...devices];
    const text = this.text();
    const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.confirmation.confirm({
      ...(trigger ? { target: trigger } : {}),
      header: text.deleteDevicesTitle,
      message:
        targets.length === 1
          ? text.deleteDeviceDescription.replace('{name}', targets[0]?.imei ?? '')
          : text.deleteDevicesDescription.replace('{count}', String(targets.length)),
      rejectButtonProps: { label: text.cancel, severity: 'secondary', outlined: true },
      acceptButtonProps: { label: text.deleteDevices, severity: 'danger' },
      accept: () => {
        if (!this.isCurrentQuery(query)) return;
        this.heading().nativeElement.focus();
        void this.deleteDevices(targets, query);
      },
      reject: () => {
        if (this.isCurrentQuery(query)) trigger?.focus();
      },
    });
  }

  private async deleteDevices(
    targets: readonly AdminDeviceFragment[],
    query: ReturnType<DevicesApi['watch']>,
  ): Promise<void> {
    if (!this.isCurrentQuery(query) || this.deleting()) return;
    this.cancelEdits.next();
    this.deletionResult.set(null);
    this.deleteProgress.set({ completed: 0, total: targets.length });
    let deleted = 0;
    const failures: { device: AdminDeviceFragment; message: string }[] = [];
    try {
      for (const device of targets) {
        // Navigation retires this query: let the submitted write settle, but do not send the remainder.
        if (!this.isCurrentQuery(query)) return;
        try {
          await this.api.delete({ id: device.id });
          deleted++;
          if (!this.isCurrentQuery(query)) return;
          this.page.update(
            (page) =>
              page && {
                ...page,
                items: page.items.filter((item) => item.id !== device.id),
              },
          );
        } catch (error: unknown) {
          if (!this.isCurrentQuery(query)) return;
          failures.push({ device, message: requestError(error, this.text().networkError) });
        }
        this.deleteProgress.set({ completed: deleted + failures.length, total: targets.length });
      }
      this.selected.set(failures.map((failure) => failure.device));
      this.deletionResult.set({ deleted, failures });
      // The server owns totals and last-page correction, including concurrent changes.
      await query.refetch();
    } catch (error: unknown) {
      if (this.isCurrentQuery(query)) this.error.set(error);
    } finally {
      if (this.isCurrentQuery(query)) this.deleteProgress.set(null);
    }
  }

  private isCurrentQuery(query: ReturnType<DevicesApi['watch']>): boolean {
    return !this.destroyRef.destroyed && this.query === query;
  }

  editSearch(value: unknown): void {
    if (typeof value !== 'string') return;
    this.search.set(value);
    this.textEdits.next();
  }

  sortChanged(event: unknown): void {
    if (typeof event !== 'object' || event === null || !('field' in event) || !('order' in event))
      return;
    if (event.order !== 1 && event.order !== -1) return;
    const field = event.field;
    const sort = field === 'imei' ? 'IMEI' : undefined;
    if (sort) this.sortEdits.next({ sort, order: event.order === 1 ? 'ASC' : 'DESC' });
  }

  resetSort(): void {
    this.applyFilters({ sort: 'CREATED_AT', order: 'DESC' });
  }

  clearFilters(): void {
    this.applyFilters({ search: '' });
  }

  changePage(event: PaginatorState): void {
    const current = this.listQuery();
    const size = event.rows ?? current.pageSize;
    if (!devicePageSizes.includes(size)) return;
    this.navigate({
      ...current,
      pageSize: size,
      page: size === current.pageSize ? (event.page ?? 0) + 1 : 1,
    });
  }

  private applyFilters(changes: Partial<DeviceListQuery>, replaceUrl = false): void {
    this.cancelEdits.next();
    this.navigate({ ...this.listQuery(), page: 1, search: this.search(), ...changes }, replaceUrl);
  }

  private navigate(query: DeviceListQuery, replaceUrl = false): void {
    const normalized = readDeviceListQuery(convertToParamMap(deviceListQueryParams(query)));
    // Angular skips unchanged URLs, so reset drafts even when no route event will follow.
    this.search.set(normalized.search);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: deviceListQueryParams(normalized),
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl,
    });
  }

  private normalizeUrl(params: ParamMap): void {
    const query = readDeviceListQuery(params);
    const expected = deviceListQueryParams(query);
    if (
      Object.entries(expected).some(
        ([key, value]) =>
          params.get(key) !== value || params.getAll(key).length > (value === null ? 0 : 1),
      )
    )
      this.navigate(query, true);
  }
}
