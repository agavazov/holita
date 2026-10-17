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
  AdminVehicleFragment,
  AdminVehiclesQuery,
  AdminBranchesQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { VehiclesApi } from './vehicles-api';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { InputText } from 'primeng/inputtext';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  vehicleListQueryParams,
  vehicleListVariables,
  vehiclePageSizes,
  readVehicleListQuery,
  sameVehicleListQuery,
  type VehicleListQuery,
} from './vehicle-list-query';

@Component({
  selector: 'holita-vehicles-page',
  providers: [VehiclesApi, ConfirmationService],
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
  templateUrl: './vehicles-page.html',
  styleUrls: ['../fleet-list.scss', './vehicles-page.scss'],
})
export class VehiclesPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly api = inject(VehiclesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly saved =
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.extras.state?.[
      'vehicleSaved'
    ] === true;
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('vehiclesHeading');
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly listQuery = computed(() => readVehicleListQuery(this.params()));
  readonly selected = linkedSignal<VehicleListQuery, AdminVehicleFragment[]>({
    source: this.listQuery,
    computation: (query, previous) =>
      previous && sameVehicleListQuery(query, previous.source) ? previous.value : [],
  });
  readonly deleteProgress = signal<{ completed: number; total: number } | null>(null);
  readonly deleting = computed(() => this.deleteProgress() !== null);
  readonly deletionResult = signal<{
    deleted: number;
    failures: { vehicle: AdminVehicleFragment; message: string }[];
  } | null>(null);
  readonly deletingMessage = computed(() => {
    const progress = this.deleteProgress();
    return progress
      ? this.text()
          .deletingVehicles.replace('{completed}', String(progress.completed))
          .replace('{total}', String(progress.total))
      : '';
  });
  readonly deletionSummary = computed(() => {
    const result = this.deletionResult();
    if (!result) return '';
    return (
      this.text().vehiclesDeleted.replace('{count}', String(result.deleted)) +
      (result.failures.length
        ? ' ' + this.text().vehiclesDeleteFailed.replace('{count}', String(result.failures.length))
        : '')
    );
  });
  readonly search = linkedSignal(() => this.listQuery().search);
  readonly pageSizes = vehiclePageSizes;
  readonly sortField = computed(() => {
    const fields = {
      LICENSE_PLATE: 'licensePlate',
      CREATED_AT: 'createdAt',
    };
    return fields[this.listQuery().sort];
  });
  readonly sortOrder = computed(() => (this.listQuery().order === 'ASC' ? 1 : -1));
  private readonly textEdits = new Subject<void>();
  private readonly cancelEdits = new Subject<void>();
  private readonly sortEdits = new Subject<Pick<VehicleListQuery, 'sort' | 'order'>>();
  private query: ReturnType<VehiclesApi['watch']> | undefined;
  readonly page = signal<AdminVehiclesQuery['fleetVehicles'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly trackVehicle = (_index: number, vehicle: AdminVehicleFragment) => vehicle.id;

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
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
        map(readVehicleListQuery),
        distinctUntilChanged(sameVehicleListQuery),
        switchMap((params) => {
          this.confirmation.close();
          this.deleteProgress.set(null);
          this.page.set(null);
          this.error.set(null);
          this.loading.set(true);
          const query = this.api.watch(vehicleListVariables(params));
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
          const vehicles = result.data.fleetVehicles;
          const current = this.listQuery();
          const lastPage = Math.max(1, Math.ceil(vehicles.total / current.pageSize));
          if (current.page > lastPage) {
            // Cached totals may be stale; wait for a successful network result before correcting the URL.
            if (!result.loading) this.navigate({ ...current, page: lastPage }, true);
          } else {
            this.page.set(vehicles);
            const selectedIds = new Set(this.selected().map((vehicle) => vehicle.id));
            this.selected.set(vehicles.items.filter((vehicle) => selectedIds.has(vehicle.id)));
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

  selectVehicles(value: unknown): void {
    if (this.deleting() || !Array.isArray(value)) return;
    const ids = new Set(
      value.flatMap((vehicle: unknown) =>
        typeof vehicle === 'object' &&
        vehicle !== null &&
        'id' in vehicle &&
        typeof vehicle.id === 'string'
          ? [vehicle.id]
          : [],
      ),
    );
    this.selected.set(this.page()?.items.filter((vehicle) => ids.has(vehicle.id)) ?? []);
  }

  confirmDelete(vehicles: readonly AdminVehicleFragment[], event: Event): void {
    const query = this.query;
    if (this.deleting() || !query || vehicles.length === 0) return;
    const targets = [...vehicles];
    const text = this.text();
    const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.confirmation.confirm({
      ...(trigger ? { target: trigger } : {}),
      header: text.deleteVehiclesTitle,
      message:
        targets.length === 1
          ? text.deleteVehicleDescription.replace('{name}', targets[0]?.licensePlate ?? '')
          : text.deleteVehiclesDescription.replace('{count}', String(targets.length)),
      rejectButtonProps: { label: text.cancel, severity: 'secondary', outlined: true },
      acceptButtonProps: { label: text.deleteVehicles, severity: 'danger' },
      accept: () => {
        if (!this.isCurrentQuery(query)) return;
        this.heading().nativeElement.focus();
        void this.deleteVehicles(targets, query);
      },
      reject: () => {
        if (this.isCurrentQuery(query)) trigger?.focus();
      },
    });
  }

  private async deleteVehicles(
    targets: readonly AdminVehicleFragment[],
    query: ReturnType<VehiclesApi['watch']>,
  ): Promise<void> {
    if (!this.isCurrentQuery(query) || this.deleting()) return;
    this.cancelEdits.next();
    this.deletionResult.set(null);
    this.deleteProgress.set({ completed: 0, total: targets.length });
    let deleted = 0;
    const failures: { vehicle: AdminVehicleFragment; message: string }[] = [];
    try {
      for (const vehicle of targets) {
        // Navigation retires this query: let the submitted write settle, but do not send the remainder.
        if (!this.isCurrentQuery(query)) return;
        try {
          await this.api.delete({ id: vehicle.id });
          deleted++;
          if (!this.isCurrentQuery(query)) return;
          this.page.update(
            (page) =>
              page && {
                ...page,
                items: page.items.filter((item) => item.id !== vehicle.id),
              },
          );
        } catch (error: unknown) {
          if (!this.isCurrentQuery(query)) return;
          failures.push({ vehicle, message: requestError(error, this.text().networkError) });
        }
        this.deleteProgress.set({ completed: deleted + failures.length, total: targets.length });
      }
      this.selected.set(failures.map((failure) => failure.vehicle));
      this.deletionResult.set({ deleted, failures });
      // The server owns totals and last-page correction, including concurrent changes.
      await query.refetch();
    } catch (error: unknown) {
      if (this.isCurrentQuery(query)) this.error.set(error);
    } finally {
      if (this.isCurrentQuery(query)) this.deleteProgress.set(null);
    }
  }

  private isCurrentQuery(query: ReturnType<VehiclesApi['watch']>): boolean {
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
    const sort = field === 'licensePlate' ? 'LICENSE_PLATE' : undefined;
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
    if (!vehiclePageSizes.includes(size)) return;
    this.navigate({
      ...current,
      pageSize: size,
      page: size === current.pageSize ? (event.page ?? 0) + 1 : 1,
    });
  }

  private applyFilters(changes: Partial<VehicleListQuery>, replaceUrl = false): void {
    this.cancelEdits.next();
    this.navigate({ ...this.listQuery(), page: 1, search: this.search(), ...changes }, replaceUrl);
  }

  private navigate(query: VehicleListQuery, replaceUrl = false): void {
    const normalized = readVehicleListQuery(convertToParamMap(vehicleListQueryParams(query)));
    // Angular skips unchanged URLs, so reset drafts even when no route event will follow.
    this.search.set(normalized.search);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: vehicleListQueryParams(normalized),
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl,
    });
  }

  private normalizeUrl(params: ParamMap): void {
    const query = readVehicleListQuery(params);
    const expected = vehicleListQueryParams(query);
    if (
      Object.entries(expected).some(
        ([key, value]) =>
          params.get(key) !== value || params.getAll(key).length > (value === null ? 0 : 1),
      )
    )
      this.navigate(query, true);
  }
}
