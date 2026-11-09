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
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminFleetOverviewQuery,
  AdminOverviewMapQuery,
  AdminOverviewConnectedDevicesQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { WALL_CLOCK } from '../../../ui/clock';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { OverviewApi } from './overview-api';
import { OverviewView, type OverviewLinks } from './overview-view';
import { overviewPeriod, type OverviewDays, type OverviewFilter } from './overview-period';

@Component({
  selector: 'discocan-overview-page',
  imports: [OverviewView],
  providers: [OverviewApi],
  template: `
    <discocan-overview-view
      [branchName]="branch().name"
      [data]="data()"
      [loading]="loading()"
      [errorText]="failure()"
      [links]="links()"
      [days]="days()"
      [period]="displayPeriod()"
      [mapData]="mapData()"
      [mapLoading]="mapLoading()"
      [mapError]="mapFailure()"
      [filter]="filter()"
      [vehicleId]="vehicleId()"
      [devicesData]="devicesData()"
      [devicesLoading]="devicesLoading()"
      [devicesError]="devicesFailure()"
      (retry)="refresh()"
      (periodChange)="changePeriod($event)"
      (filterChange)="changeFilter($event)"
      (vehicleSelect)="selectVehicle($event)"
      (distanceDaySelect)="openTrips($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(OverviewApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly units = injectFleetFormat();
  private readonly reload = new Subject<void>();
  private readonly mapReload = new Subject<void>();
  private readonly devicesReload = new Subject<void>();
  readonly data = signal<AdminFleetOverviewQuery | null>(null);
  readonly mapData = signal<AdminOverviewMapQuery['fleetMap'] | null>(null);
  readonly devicesData = signal<AdminOverviewConnectedDevicesQuery['fleetDevices'] | null>(null);
  readonly days = signal<OverviewDays>(7);
  readonly filter = signal<OverviewFilter>('all');
  readonly vehicleId = signal<string | null>(null);
  private readonly wallClock = inject(WALL_CLOCK);
  private readonly now = signal(new Date(this.wallClock()).toISOString());
  private readonly period = computed(() =>
    overviewPeriod(this.days(), this.units.preferences().timeZone, this.now()),
  );
  private readonly loadedPeriod = signal<ReturnType<typeof overviewPeriod> | null>(null);
  readonly displayPeriod = computed(() => this.loadedPeriod() ?? this.period());
  readonly loading = signal(true);
  readonly mapLoading = signal(true);
  readonly devicesLoading = signal(false);
  private readonly error = signal<unknown>(null);
  private readonly mapError = signal<unknown>(null);
  private readonly devicesError = signal<unknown>(null);
  readonly failure = computed(() =>
    this.error() ? requestError(this.error(), messages[this.language()].networkError) : null,
  );
  readonly mapFailure = computed(() =>
    this.mapError() ? requestError(this.mapError(), messages[this.language()].networkError) : null,
  );
  readonly devicesFailure = computed(() =>
    this.devicesError()
      ? requestError(this.devicesError(), messages[this.language()].networkError)
      : null,
  );
  readonly links = computed<OverviewLinks>(() => {
    const base = ['/', this.language(), this.branch().id, 'fleet'];
    return {
      overview: [...base, 'dashboard', 'overview'],
      problems: [...base, 'dashboard', 'problems'],
      trips: [...base, 'dashboard', 'trips'],
      vehicles: [...base, 'vehicles'],
      devices: [...base, 'devices'],
      maintenance: [...base, 'maintenance'],
      drivers: [...base, 'drivers'],
    };
  });

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const rawDays = params.get('days');
      const days = rawDays === '14' ? 14 : rawDays === '30' ? 30 : 7;
      const rawFilter = params.get('view');
      const filter =
        rawFilter === 'live' ||
        rawFilter === 'waiting' ||
        rawFilter === 'disconnected' ||
        rawFilter === 'connected'
          ? rawFilter
          : 'all';
      if (this.days() !== days) {
        this.days.set(days);
        this.reload.next();
      }
      if (this.filter() !== filter) {
        this.filter.set(filter);
        this.devicesReload.next();
      }
      this.vehicleId.set(params.get('vehicleId'));
    });
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          const period = this.period();
          return this.api
            .watch({ from: period.from, to: period.to, days: period.days })
            .valueChanges.pipe(
              catchError((error: unknown) => {
                this.loading.set(false);
                this.error.set(error);
                return EMPTY;
              }),
              tap((result) => {
                this.loading.set(result.loading);
                this.error.set(result.error ?? null);
                if (result.dataState === 'complete') {
                  this.data.set(result.data);
                  this.loadedPeriod.set(period);
                }
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.mapReload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.mapLoading.set(true);
          this.mapError.set(null);
          return this.api.map().pipe(
            catchError((error: unknown) => {
              this.mapLoading.set(false);
              this.mapError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        if (!this.mapData() || this.mapData()?.hasMore || !page.hasMore) {
          this.mapData.set(page);
        }
        this.mapLoading.set(page.hasMore);
      });
    this.devicesReload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          if (this.filter() !== 'connected') {
            return EMPTY;
          }
          this.devicesLoading.set(true);
          this.devicesError.set(null);
          return this.api.connectedDevices().pipe(
            catchError((error: unknown) => {
              this.devicesLoading.set(false);
              this.devicesError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        const previous = this.devicesData();
        if (
          !previous ||
          previous.offset + previous.limit < previous.total ||
          page.offset + page.limit >= page.total
        ) {
          this.devicesData.set(page);
        }
        this.devicesLoading.set(page.offset + page.limit < page.total);
      });
  }

  refresh(): void {
    this.now.set(new Date(this.wallClock()).toISOString());
    this.reload.next();
    this.mapReload.next();
    this.devicesReload.next();
  }

  openTrips(day: string): void {
    void this.router.navigate([...this.links().trips], {
      queryParams: {
        conditions: JSON.stringify([
          { id: 'dashboard-day', field: 'startedAt', operator: 'on', values: [day] },
        ]),
      },
    });
  }

  changePeriod(days: OverviewDays): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { days },
      queryParamsHandling: 'merge',
    });
  }
  changeFilter(view: OverviewFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'all' ? null : view, vehicleId: null },
      queryParamsHandling: 'merge',
    });
  }
  selectVehicle(vehicleId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vehicleId },
      queryParamsHandling: 'merge',
    });
  }
}
