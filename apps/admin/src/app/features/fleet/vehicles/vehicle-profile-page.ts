import { driverReturnId, fleetRecordLinks } from '../fleet-record-links';
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
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminVehicleProfileQuery,
  AdminVehicleProfileTripsQuery,
  AdminVehicleProfileAlertsQuery,
  AdminVehicleProfileServiceQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { injectPageRecord } from '../../../layout/page-record';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import { errorCode } from '../../../ui/forms/field-errors';
import { tableView } from '../../../ui/table-panel/table-view';
import { alertRow } from '../alerts/alert-mapping';
import { serviceTaskRow } from '../maintenance/service-task-mapping';
import { tripRow } from '../trips/trip-mapping';
import { vehiclesText } from './i18n/messages';
import { VehicleProfileApi } from './vehicle-profile-api';
import { vehicleDistance, vehicleProfile } from './vehicle-profile-mapping';
import {
  profileBackParams,
  profilePage,
  profilePageParams,
  profileTab,
  type ProfileListTab,
  type ProfilePage,
} from './vehicle-profile-query';
import {
  VehicleProfileView,
  type VehicleProfileState,
  type VehicleProfileTab,
} from './vehicle-profile-view';

const samePage = (left: ProfilePage, right: ProfilePage) =>
  left.page === right.page && left.pageSize === right.pageSize;

@Component({
  selector: 'holita-vehicle-profile-page',
  imports: [VehicleProfileView, RouterOutlet],
  providers: [VehicleProfileApi],
  template: `
    <holita-vehicle-profile-view
      [recordLinks]="recordLinks()"
      [state]="state()"
      [vehicle]="vehicle()"
      [dataAsOf]="record()?.fleetDataClock.asOf ?? ''"
      [backLink]="backLink()"
      [backLabel]="backLabel()"
      [backQueryParams]="backQueryParams()"
      [backFragment]="fragment()"
      [errorText]="failure()"
      [distance]="distance()"
      [nextServiceTask]="nextService()"
      [tab]="tab()"
      (tabChange)="changeTab($event)"
      (retry)="retry.next()"
      (edit)="open('edit')"
      (recordOdometer)="open('odometer')"
      [trips]="trips()"
      [tripPage]="tripPage()"
      [tripState]="tripView()"
      [tripError]="tripFailure()"
      (tripPageChange)="changePage('trips', $event)"
      (retryTrips)="retryTrips.next()"
      [alerts]="alerts()"
      [alertPage]="alertPage()"
      [alertState]="alertView()"
      [alertError]="alertFailure()"
      (alertPageChange)="changePage('alerts', $event)"
      (retryAlerts)="retryAlerts.next()"
      [service]="service()"
      [servicePage]="servicePage()"
      [serviceState]="serviceView()"
      [serviceError]="serviceFailure()"
      (servicePageChange)="changePage('service', $event)"
      (retryService)="retryService.next()"
      (openTrip)="related('trips', $event)"
      (openAlert)="related('alerts', $event)"
      (openService)="related('service', $event)"
    />
    @if (record()) {
      <router-outlet [routerOutletData]="drawerHost()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleProfilePage implements OnInit {
  protected readonly recordLinks = computed(() =>
    fleetRecordLinks(this.language(), this.branch().id),
  );
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(VehicleProfileApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });
  readonly state = signal<VehicleProfileState>('loading');
  readonly record = signal<AdminVehicleProfileQuery | null>(null);
  readonly error = signal<unknown>(null);
  readonly tab = computed(() => profileTab(this.params().get('tab')));
  readonly vehicle = computed(() => {
    const record = this.record();
    return record ? vehicleProfile(record.fleetVehicle) : null;
  });
  protected readonly distance = computed(() => {
    const record = this.record();
    return record ? vehicleDistance(record.fleetDailyDistance, this.language()) : [];
  });
  protected readonly nextService = computed(() => {
    const task = this.record()?.fleetVehicle.nextService;
    return task ? serviceTaskRow(task, this.language()) : null;
  });
  private readonly fromDriver = computed(() =>
    this.queryParams().getAll('fromDriver').length === 1
      ? driverReturnId(this.queryParams().get('fromDriver'))
      : null,
  );
  private readonly vehicleListLink = computed(() => [
    '/',
    this.language(),
    this.branch().id,
    'fleet',
    'vehicles',
  ]);
  protected readonly backLink = computed(() => {
    const driverId = this.fromDriver();
    return driverId
      ? ['/', this.language(), this.branch().id, 'fleet', 'drivers', driverId]
      : this.vehicleListLink();
  });
  protected readonly backLabel = computed(() =>
    this.fromDriver()
      ? vehiclesText(this.language()).profile.backToDriver
      : vehiclesText(this.language()).profile.back,
  );
  protected readonly backQueryParams = computed(() =>
    this.fromDriver() ? null : profileBackParams(this.queryParams()),
  );
  protected readonly profileLink = computed(() => [
    ...this.vehicleListLink(),
    drawerParam(this.route, 'recordId') ?? '',
    this.tab(),
  ]);
  protected readonly retry = new Subject<void>();
  protected readonly retryTrips = new Subject<void>();
  protected readonly retryAlerts = new Subject<void>();
  protected readonly retryService = new Subject<void>();
  protected readonly failure = computed(() =>
    requestError(this.error(), vehiclesText(this.language()).profile.errorText),
  );
  private readonly tripData = signal<AdminVehicleProfileTripsQuery['fleetTrips'] | null>(null);
  private readonly alertData = signal<AdminVehicleProfileAlertsQuery['fleetEvents'] | null>(null);
  private readonly serviceData = signal<
    AdminVehicleProfileServiceQuery['fleetServiceTasks'] | null
  >(null);
  private readonly tripError = signal<unknown>(null);
  private readonly alertError = signal<unknown>(null);
  private readonly serviceError = signal<unknown>(null);
  private readonly tripLoading = signal(true);
  private readonly alertLoading = signal(true);
  private readonly serviceLoading = signal(true);
  protected readonly trips = computed(() =>
    (this.tripData()?.items ?? []).map((trip) => tripRow(trip, this.language())),
  );
  protected readonly alerts = computed(() =>
    (this.alertData()?.items ?? []).flatMap((event) => {
      const row = alertRow(event, this.language());
      return row ? [row] : [];
    }),
  );
  protected readonly service = computed(() =>
    (this.serviceData()?.items ?? []).map((task) => serviceTaskRow(task, this.language())),
  );
  protected readonly tripPage = computed(() => ({
    ...profilePage(this.queryParams(), 'trips'),
    total: this.tripData()?.total ?? 0,
  }));
  protected readonly alertPage = computed(() => ({
    ...profilePage(this.queryParams(), 'alerts'),
    total: this.alertData()?.total ?? 0,
  }));
  protected readonly servicePage = computed(() => ({
    ...profilePage(this.queryParams(), 'service'),
    total: this.serviceData()?.total ?? 0,
  }));
  protected readonly tripView = computed(() =>
    tableView({
      loading: this.tripLoading(),
      error: this.tripError(),
      rows: this.tripData() ? this.trips().length : null,
      filtered: false,
    }),
  );
  protected readonly alertView = computed(() =>
    tableView({
      loading: this.alertLoading(),
      error: this.alertError(),
      rows: this.alertData() ? this.alerts().length : null,
      filtered: false,
    }),
  );
  protected readonly serviceView = computed(() =>
    tableView({
      loading: this.serviceLoading(),
      error: this.serviceError(),
      rows: this.serviceData() ? this.service().length : null,
      filtered: false,
    }),
  );
  protected readonly tripFailure = computed(() =>
    requestError(this.tripError(), vehiclesText(this.language()).table.errorText),
  );
  protected readonly alertFailure = computed(() =>
    requestError(this.alertError(), vehiclesText(this.language()).table.errorText),
  );
  protected readonly serviceFailure = computed(() =>
    requestError(this.serviceError(), vehiclesText(this.language()).table.errorText),
  );
  readonly drawerHost = computed<DrawerHost>(() => {
    const vehicleId = this.record()?.fleetVehicle.id;
    return {
      closeLink: this.profileLink(),
      ...(vehicleId === undefined ? {} : { vehicleId }),
      saved: ({ message }) => {
        if (this.destroyRef.destroyed) {
          return;
        }
        this.notifications.add({ severity: 'success', summary: message, life: 5000 });
        this.retry.next();
        this.retryTrips.next();
        this.retryAlerts.next();
        this.retryService.next();
      },
    };
  });

  constructor() {
    injectPageRecord(() => this.vehicle()?.plate ?? null);
  }

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    const id = drawerParam(this.route, 'recordId');
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('not-found');
      return;
    }
    let relatedStarted = false;
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.error.set(null);
          return this.api.watchVehicle(id).valueChanges.pipe(
            catchError((error: unknown) => {
              this.fail(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.fail(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          this.record.set(result.data);
          this.state.set('ready');
          if (!relatedStarted) {
            relatedStarted = true;
            this.loadTrips(id);
            this.loadAlerts(id);
            this.loadService(id);
          }
        }
      });
  }

  changeTab(tab: VehicleProfileTab): void {
    void this.router.navigate(
      [...this.vehicleListLink(), drawerParam(this.route, 'recordId'), tab],
      {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      },
    );
  }

  changePage(tab: ProfileListTab, value: ProfilePage): void {
    const current = profilePage(this.queryParams(), tab);
    const next = { ...value, page: value.pageSize === current.pageSize ? value.page : 1 };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: profilePageParams(tab, next),
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  open(kind: 'edit' | 'odometer'): void {
    if (this.state() !== 'ready') {
      return;
    }
    void this.router.navigate([kind], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  related(kind: 'trips' | 'alerts' | 'service', id: string): void {
    if (this.destroyRef.destroyed || this.state() !== 'ready') {
      return;
    }
    const task =
      kind === 'service' ? this.serviceData()?.items.find((task) => task.id === id) : null;
    if (kind === 'service' && !task) {
      return;
    }
    void this.router.navigate(task?.status === 'PLANNED' ? [kind, id, 'edit'] : [kind, id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  private fail(error: unknown): void {
    this.error.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }

  private loadTrips(id: string): void {
    let previous: ProfilePage | null = null;
    const pages = this.route.queryParamMap.pipe(
      map((params) => profilePage(params, 'trips')),
      distinctUntilChanged(samePage),
    );
    combineLatest([pages, this.retryTrips.pipe(startWith(undefined))])
      .pipe(
        switchMap(([page]) => {
          if (previous === null || !samePage(previous, page)) {
            this.tripData.set(null);
          }
          previous = page;
          this.tripLoading.set(true);
          this.tripError.set(null);
          return this.api.watchTrips(id, page.page, page.pageSize).valueChanges.pipe(
            catchError((error: unknown) => {
              this.tripLoading.set(false);
              this.tripError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.tripLoading.set(result.loading);
        this.tripError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.tripData.set(result.data.fleetTrips);
          this.correctPages();
        }
      });
  }

  private loadAlerts(id: string): void {
    let previous: ProfilePage | null = null;
    const pages = this.route.queryParamMap.pipe(
      map((params) => profilePage(params, 'alerts')),
      distinctUntilChanged(samePage),
    );
    combineLatest([pages, this.retryAlerts.pipe(startWith(undefined))])
      .pipe(
        switchMap(([page]) => {
          if (previous === null || !samePage(previous, page)) {
            this.alertData.set(null);
          }
          previous = page;
          this.alertLoading.set(true);
          this.alertError.set(null);
          return this.api.watchAlerts(id, page.page, page.pageSize).valueChanges.pipe(
            catchError((error: unknown) => {
              this.alertLoading.set(false);
              this.alertError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.alertLoading.set(result.loading);
        this.alertError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.alertData.set(result.data.fleetEvents);
          this.correctPages();
        }
      });
  }

  private loadService(id: string): void {
    let previous: ProfilePage | null = null;
    const pages = this.route.queryParamMap.pipe(
      map((params) => profilePage(params, 'service')),
      distinctUntilChanged(samePage),
    );
    combineLatest([pages, this.retryService.pipe(startWith(undefined))])
      .pipe(
        switchMap(([page]) => {
          if (previous === null || !samePage(previous, page)) {
            this.serviceData.set(null);
          }
          previous = page;
          this.serviceLoading.set(true);
          this.serviceError.set(null);
          return this.api.watchService(id, page.page, page.pageSize).valueChanges.pipe(
            catchError((error: unknown) => {
              this.serviceLoading.set(false);
              this.serviceError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.serviceLoading.set(result.loading);
        this.serviceError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.serviceData.set(result.data.fleetServiceTasks);
          this.correctPages();
        }
      });
  }

  private correctPages(): void {
    const totals: Record<ProfileListTab, number | null> = {
      trips: this.tripData()?.total ?? null,
      alerts: this.alertData()?.total ?? null,
      service: this.serviceData()?.total ?? null,
    };
    const corrections: Record<string, string | number | null> = {};
    let changed = false;
    for (const tab of ['trips', 'alerts', 'service'] as const) {
      const current = profilePage(this.queryParams(), tab);
      const total = totals[tab];
      const last = total === null ? current.page : Math.max(1, Math.ceil(total / current.pageSize));
      const next = profilePageParams(tab, { ...current, page: Math.min(current.page, last) });
      for (const key of [tab + 'Page', tab + 'Size']) {
        const value: unknown = next[key];
        if (value === null || typeof value === 'number') {
          corrections[key] = value;
          changed ||= this.queryParams().get(key) !== (value === null ? null : String(value));
        }
      }
    }
    if (changed) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: corrections,
        queryParamsHandling: 'merge',
        preserveFragment: true,
        replaceUrl: true,
      });
    }
  }
}
