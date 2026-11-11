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
  expand,
  filter,
  timer,
  last,
  map,
  startWith,
  switchMap,
  take,
  takeWhile,
} from 'rxjs';
import { faultReadState, faultsText } from '../../../ui/fleet-live/fault-wording';
import type {
  AdminBranchesQuery,
  AdminVehicleProfileQuery,
  AdminVehicleProfileTripsQuery,
  AdminVehicleProfileProblemsQuery,
  AdminVehicleMapQuery,
  AdminVehicleTrackQuery,
  AdminVehicleEdataMeasurementsQuery,
  AdminVehicleProfileServiceQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { injectPageRecord } from '../../../layout/page-record';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import { errorCode } from '../../../ui/forms/field-errors';
import { WALL_CLOCK } from '../../../ui/clock';
import { tableView } from '../../../ui/table-panel/table-view';
import { serviceTaskRow } from '../maintenance/service-task-mapping';
import { tripRow } from '../trips/trip-mapping';
import { vehiclesText } from './i18n/messages';
import { VehicleProfileApi } from './vehicle-profile-api';
import {
  vehicleDistance,
  vehicleEdataObservations,
  vehicleProfile,
} from './vehicle-profile-mapping';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { vehicleMapRecords, vehicleRecordedTrack } from './vehicle-profile-map';
import {
  profileBackParams,
  profilePage,
  profilePageParams,
  profileSortParams,
  profileTab,
  type ProfileListTab,
  type ProfilePage,
  type ProfileListQuery,
  type ProfileSort,
} from './vehicle-profile-query';
import {
  VehicleProfileView,
  type VehicleProfileState,
  type VehicleProfileTab,
} from './vehicle-profile-view';

const samePage = (left: ProfileListQuery, right: ProfileListQuery) =>
  left.page === right.page &&
  left.pageSize === right.pageSize &&
  left.sort.field === right.sort.field &&
  left.sort.direction === right.sort.direction;

@Component({
  selector: 'discocan-vehicle-profile-page',
  imports: [VehicleProfileView, RouterOutlet],
  providers: [VehicleProfileApi],
  template: `
    <discocan-vehicle-profile-view
      [canOperate]="canOperate()"
      [branchId]="branch().id"
      [recordLinks]="recordLinks()"
      [deviceLinkBase]="['/', language(), branch().id, 'fleet', 'devices']"
      [state]="state()"
      [vehicle]="vehicle()"
      [dataAsOf]="record()?.fleetDataClock.asOf ?? ''"
      [backLink]="backLink()"
      [backLabel]="backLabel()"
      [backQueryParams]="backQueryParams()"
      [backFragment]="fragment()"
      [errorText]="failure()"
      [distance]="distance()"
      [edataObservations]="edataObservations()"
      [mapRecords]="mapRecords()"
      [mapSpeedKph]="mapSpeedKph()"
      [mapAsOf]="mapData()?.asOf ?? null"
      [mapUpdatedAt]="mapData()?.liveAsOf ?? null"
      [mapDataAsOf]="mapData()?.dataAsOf ?? null"
      [track]="track()"
      [trackLoading]="trackLoading()"
      [trackError]="trackFailure()"
      (retryTrack)="retryTrack.next()"
      [edataFrom]="edataFrom()"
      [edataTo]="edataTo()"
      [edataLoading]="edataLoading()"
      [edataError]="edataFailure()"
      [edataTruncated]="edataData()?.truncated ?? false"
      (retryEdata)="retryEdata.next()"
      [nextServiceTask]="nextService()"
      [tab]="tab()"
      (tabChange)="changeTab($event)"
      (retry)="retry.next()"
      (edit)="open('edit')"
      (recordOdometer)="open('odometer')"
      [trips]="trips()"
      [tripPage]="tripPage()"
      [tripSort]="tripPage().sort"
      [tripState]="tripView()"
      [tripError]="tripFailure()"
      (tripPageChange)="changePage('trips', $event)"
      (tripSortChange)="changeSort('trips', $event)"
      (retryTrips)="retryTrips.next()"
      [problems]="problems()"
      [problemCounts]="problemData()?.counts ?? null"
      [hasFaultReports]="hasFaultReports()"
      [problemPage]="problemPage()"
      [problemSort]="problemPage().sort"
      [problemState]="problemView()"
      [problemError]="problemFailure()"
      (problemPageChange)="changePage('problems', $event)"
      (problemSortChange)="changeSort('problems', $event)"
      (retryProblems)="retryProblems.next()"
      [service]="service()"
      [servicePage]="servicePage()"
      [serviceSort]="servicePage().sort"
      [serviceState]="serviceView()"
      [serviceError]="serviceFailure()"
      (servicePageChange)="changePage('service', $event)"
      (serviceSortChange)="changeSort('service', $event)"
      (retryService)="retryService.next()"
      (openTrip)="related('trips', $event)"
      (openAlert)="related('alerts', $event)"
      (openService)="related('service', $event)"
      [faultReadBusy]="faultReadBusy()"
      (readFaults)="readFaults($event)"
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
  private readonly session = inject(DemoSession);
  protected readonly canOperate = computed(() => this.session.hasRole('OPERATOR'));
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
  protected readonly faultReadBusy = signal(false);
  readonly error = signal<unknown>(null);
  readonly tab = computed(() => profileTab(this.params().get('tab')));
  private readonly units = injectFleetFormat();
  private readonly wallClock = inject(WALL_CLOCK);
  readonly vehicle = computed(() => {
    const record = this.record();
    return record ? vehicleProfile(record.fleetVehicle, record.fleetVehicleFreezeFrame) : null;
  });
  protected readonly distance = computed(() => {
    const record = this.record();
    return record ? vehicleDistance(record.fleetDailyDistance, this.units.dateOnly) : [];
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
  protected readonly retryProblems = new Subject<void>();
  protected readonly retryTrack = new Subject<void>();
  protected readonly mapData = signal<AdminVehicleMapQuery['fleetMap'] | null>(null);
  private readonly mapError = signal<unknown>(null);
  private readonly trackData = signal<AdminVehicleTrackQuery['fleetVehicleSamples'] | null>(null);
  protected readonly trackLoading = signal(true);
  private readonly trackError = signal<unknown>(null);
  protected readonly mapRecords = computed(() =>
    vehicleMapRecords(this.mapData(), this.vehicle(), this.language()),
  );
  protected readonly mapSpeedKph = computed(
    () =>
      this.mapData()?.items.find((item) => item.vehicle.id === this.vehicle()?.id)?.position
        ?.speedKph ?? null,
  );
  protected readonly track = computed(() =>
    vehicleRecordedTrack(this.trackData(), this.language()),
  );
  protected readonly trackFailure = computed(() => {
    const error = this.mapError() ?? this.trackError();
    return error === null
      ? null
      : requestError(error, vehiclesText(this.language()).table.errorText);
  });
  protected readonly retryEdata = new Subject<void>();
  protected readonly edataData = signal<
    AdminVehicleEdataMeasurementsQuery['fleetVehicleEdataMeasurements'] | null
  >(null);
  protected readonly edataLoading = signal(true);
  private readonly edataError = signal<unknown>(null);
  protected readonly edataObservations = computed(() => vehicleEdataObservations(this.edataData()));
  protected readonly edataFrom = computed(() => this.edataData()?.from ?? '');
  protected readonly edataTo = computed(() => this.edataData()?.to ?? '');
  protected readonly edataFailure = computed(() =>
    this.edataError() === null
      ? null
      : requestError(this.edataError(), vehiclesText(this.language()).profile.edata.error),
  );
  protected readonly retryService = new Subject<void>();
  protected readonly failure = computed(() =>
    requestError(this.error(), vehiclesText(this.language()).profile.errorText),
  );
  private readonly tripData = signal<AdminVehicleProfileTripsQuery['fleetTrips'] | null>(null);
  protected readonly problemData = signal<AdminVehicleProfileProblemsQuery['fleetProblems'] | null>(
    null,
  );
  private readonly serviceData = signal<
    AdminVehicleProfileServiceQuery['fleetServiceTasks'] | null
  >(null);
  private readonly tripError = signal<unknown>(null);
  private readonly problemError = signal<unknown>(null);
  private readonly serviceError = signal<unknown>(null);
  private readonly tripLoading = signal(true);
  private readonly problemLoading = signal(true);
  private readonly serviceLoading = signal(true);
  protected readonly trips = computed(() =>
    (this.tripData()?.items ?? []).map((trip) => tripRow(trip, this.language())),
  );
  protected readonly problems = computed(() => this.problemData()?.items ?? []);
  protected readonly hasFaultReports = computed(() => {
    const record = this.record();
    return record ? record.recordedFaultReports.total > 0 : null;
  });
  protected readonly service = computed(() =>
    (this.serviceData()?.items ?? []).map((task) => serviceTaskRow(task, this.language())),
  );
  protected readonly tripPage = computed(() => ({
    ...profilePage(this.queryParams(), 'trips'),
    total: this.tripData()?.total ?? 0,
  }));
  protected readonly problemPage = computed(() => ({
    ...profilePage(this.queryParams(), 'problems'),
    total: this.problemData()?.total ?? 0,
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
  protected readonly problemView = computed(() =>
    tableView({
      loading: this.problemLoading(),
      error: this.problemError(),
      rows: this.problemData() ? this.problems().length : null,
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
  protected readonly problemFailure = computed(() =>
    requestError(this.problemError(), vehiclesText(this.language()).table.errorText),
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
        this.retryProblems.next();
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
            this.loadProblems(id);
            this.loadMap(id);
            this.loadTrack(id);
            this.loadEdata(id);
            this.loadService(id);
          }
        }
      });
  }

  changeTab(tab: VehicleProfileTab): void {
    void this.router.navigate(
      [...this.vehicleListLink(), drawerParam(this.route, 'recordId'), tab],
      {
        queryParams: { vehicleTab: null },
        queryParamsHandling: 'merge',
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

  changeSort(tab: ProfileListTab, sort: ProfileSort): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: profileSortParams(tab, sort),
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  open(kind: 'edit' | 'odometer'): void {
    if (!this.canOperate() || this.state() !== 'ready') {
      return;
    }
    void this.router.navigate([kind], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  /** Queues a fault read, then reloads the profile every 5 s for up to 2 min while it runs. */
  readFaults(deviceId: string): void {
    if (!this.canOperate() || this.faultReadBusy() || this.state() !== 'ready') {
      return;
    }
    this.faultReadBusy.set(true);
    const refresh = () => {
      this.api.refreshVehicle().catch(() => undefined);
    };
    this.api.readFaults(deviceId).then(
      () => {
        this.faultReadBusy.set(false);
        refresh();
        timer(5_000, 5_000)
          .pipe(
            take(24),
            takeWhile(
              () =>
                faultReadState(this.vehicle()?.faultReads ?? [], this.wallClock()).pending !== null,
            ),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe(refresh);
      },
      (error: unknown) => {
        this.faultReadBusy.set(false);
        this.notifications.add({
          severity: 'error',
          summary: requestError(error, faultsText(this.language()).scanner.readFailed),
          sticky: true,
        });
      },
    );
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
    let previous: ProfileListQuery | null = null;
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
          return this.api.watchTrips(id, page.page, page.pageSize, page.sort).valueChanges.pipe(
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

  private loadProblems(id: string): void {
    let previous: ProfileListQuery | null = null;
    const pages = this.route.queryParamMap.pipe(
      map((params) => profilePage(params, 'problems')),
      distinctUntilChanged(samePage),
    );
    combineLatest([pages, this.retryProblems.pipe(startWith(undefined))])
      .pipe(
        switchMap(([page]) => {
          if (previous === null || !samePage(previous, page)) {
            this.problemData.set(null);
          }
          previous = page;
          this.problemLoading.set(true);
          this.problemError.set(null);
          return this.api.watchProblems(id, page.page, page.pageSize, page.sort).valueChanges.pipe(
            catchError((error: unknown) => {
              this.problemLoading.set(false);
              this.problemError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.problemLoading.set(result.loading);
        this.problemError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.problemData.set(result.data.fleetProblems);
          this.correctPages();
        }
      });
  }

  private loadMap(id: string): void {
    combineLatest([timer(0, 30_000), this.retryTrack.pipe(startWith(undefined))])
      .pipe(
        filter(() => !document.hidden),
        switchMap(() => {
          this.mapError.set(null);
          return this.api.mapPage(0).pipe(
            expand((result) => {
              const page = result.data?.fleetMap;
              return page?.hasMore && !page.items.some((item) => item.vehicle.id === id)
                ? this.api.mapPage(page.offset + page.limit)
                : EMPTY;
            }),
            last(),
            catchError((error: unknown) => {
              this.mapError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.data?.fleetMap) {
          this.mapData.set(result.data.fleetMap);
        }
      });
  }

  private loadTrack(id: string): void {
    combineLatest([timer(0, 30_000), this.retryTrack.pipe(startWith(undefined))])
      .pipe(
        filter(() => !document.hidden),
        switchMap(() => {
          this.trackLoading.set(true);
          this.trackError.set(null);
          const to = new Date(this.wallClock()).toISOString();
          const from = new Date(Date.parse(to) - 24 * 60 * 60 * 1000).toISOString();
          return this.api.watchTrack(id, from, to).valueChanges.pipe(
            catchError((error: unknown) => {
              this.trackLoading.set(false);
              this.trackError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.trackLoading.set(result.loading);
        this.trackError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.trackData.set(result.data.fleetVehicleSamples);
        }
      });
  }

  private loadEdata(id: string): void {
    const to = new Date(this.wallClock()).toISOString();
    const from = new Date(Date.parse(to) - 24 * 60 * 60 * 1000).toISOString();
    this.retryEdata
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.edataLoading.set(true);
          this.edataError.set(null);
          return this.api.watchEdataMeasurements(id, from, to).valueChanges.pipe(
            catchError((error: unknown) => {
              this.edataLoading.set(false);
              this.edataError.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.edataLoading.set(result.loading);
        this.edataError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.loading && !result.error) {
          this.edataData.set(result.data.fleetVehicleEdataMeasurements);
        }
      });
  }

  private loadService(id: string): void {
    let previous: ProfileListQuery | null = null;
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
          return this.api.watchService(id, page.page, page.pageSize, page.sort).valueChanges.pipe(
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
      problems: this.problemData()?.total ?? null,
      service: this.serviceData()?.total ?? null,
    };
    const corrections: Record<string, string | number | null> = {};
    let changed = false;
    for (const tab of ['trips', 'problems', 'service'] as const) {
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
