import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Bullseye } from '@primeicons/angular/bullseye';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  filter,
  map,
  merge,
  type Observable,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminLiveFleetQuery,
  AdminLiveVehicleQuery,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { WALL_CLOCK } from '../../../ui/clock';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatRelative } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { mapCoordinates, type MapCoordinates } from '../../../ui/map-preview/location-map';
import { ModuleInfo } from '../../../ui/page-header/module-info';
import { StreetViewPopup } from '../../../ui/street-view/street-view-popup';
import { FleetPreferences } from '../settings/fleet-preferences';
import { LiveDashboardApi } from './live-dashboard-api';
import {
  liveTrucks,
  mergeTrail,
  nearestPoint,
  trailLines,
  trailStart,
  trailWindows,
  type LiveTruck,
  type TrailPoint,
  type TrailWindow,
  type TruckFilter,
} from './live-dashboard-model';
import { liveDashboardText } from './live-dashboard-text';
import { LiveTruckDetails } from './live-truck-details';
import { LiveTruckList } from './live-truck-list';
import { LiveTruckMap } from './live-truck-map';

/** The fleet refreshes every 15 s; the selected truck's trail grows every 10 s. */
const fleetEveryMs = 15_000;
const trailEveryMs = 10_000;
const detailEveryMs = 60_000;

interface Trail {
  readonly vehicleId: string;
  readonly window: TrailWindow;
  readonly points: readonly TrailPoint[];
  readonly truncated: boolean;
}

@Component({
  selector: 'discocan-live-dashboard-page',
  imports: [
    Bullseye,
    ButtonDirective,
    Message,
    StreetViewPopup,
    LiveTruckList,
    LiveTruckMap,
    LiveTruckDetails,
  ],
  providers: [LiveDashboardApi],
  template: `
    <h1 id="page-title" class="app-visually-hidden" tabindex="-1">{{ text().title }}</h1>
    @if (fleetError(); as error) {
      <p-message severity="error">
        {{ error }}
        <button pButton type="button" size="small" [text]="true" (click)="reload()">
          {{ text().retry }}
        </button>
      </p-message>
    }
    <div class="live-dashboard" [class.live-dashboard--details]="selected()">
      <discocan-live-truck-list
        class="live-dashboard__list"
        [language]="language()"
        [trucks]="trucks()"
        [selectedId]="selectedId()"
        [now]="now()"
        [(filter)]="filter"
        [(search)]="search"
        (truckSelect)="select($event)"
      />
      <div class="live-dashboard__stage">
        <discocan-live-truck-map
          class="live-dashboard__map"
          [language]="language()"
          [trucks]="trucks()"
          [selectedId]="selectedId()"
          [trail]="lines()"
          [routePoint]="routePosition()"
          [(follow)]="follow"
          (truckSelect)="select($event)"
          (trailSelect)="selectRoutePoint($event)"
        />
        @if (streetView(); as view) {
          <discocan-street-view-popup
            [position]="view.position"
            [heading]="view.heading"
            [label]="view.label"
            [detail]="view.detail"
            [language]="language()"
            [closable]="false"
            [(minimized)]="streetMinimized"
          >
            @if (view.route) {
              <button
                streetViewAction
                type="button"
                class="app-icon-button"
                [attr.aria-label]="text().backToLive"
                [title]="text().backToLive"
                (click)="routePoint.set(null)"
              >
                <svg data-p-icon="bullseye" aria-hidden="true"></svg>
              </button>
            }
          </discocan-street-view-popup>
        }
      </div>
      @if (selected(); as truck) {
        <discocan-live-truck-details
          class="live-dashboard__details"
          [language]="language()"
          [branchId]="branch().id"
          [truck]="truck"
          [detail]="detail()"
          [detailError]="detailError()"
          [trail]="trailPoints()"
          [trailError]="trailError()"
          [trailTruncated]="trail()?.truncated ?? false"
          [limitKph]="limitKph()"
          [now]="now()"
          [window]="window()"
          (windowChange)="changeWindow($event)"
          (closed)="select(null)"
        />
      }
    </div>
  `,
  styleUrl: './live-dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveDashboardPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(LiveDashboardApi);
  private readonly preferences = inject(FleetPreferences);
  private readonly moduleInfo = inject(ModuleInfo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wallClock = inject(WALL_CLOCK);
  private readonly document = inject(DOCUMENT);
  /** Polling pauses in a hidden browser tab and resumes on its next tick. */
  private readonly visible = () => this.document.visibilityState === 'visible';
  private readonly format = injectFleetFormat();

  protected readonly text = computed(() => liveDashboardText(this.language()));
  protected readonly now = signal(this.wallClock());
  protected readonly fleet = signal<AdminLiveFleetQuery | null>(null);
  protected readonly fleetError = signal<string | null>(null);
  protected readonly filter = signal<TruckFilter>('all');
  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('truck'),
  );
  protected readonly window = signal<TrailWindow>(
    trailWindows.find((value) => value === this.route.snapshot.queryParamMap.get('window')) ??
      'day',
  );
  protected readonly follow = signal(true);
  /** A clicked route report; null while Street View follows the truck's last position. */
  protected readonly routePoint = signal<TrailPoint | null>(null);
  protected readonly streetMinimized = signal(false);
  protected readonly detail = signal<AdminLiveVehicleQuery | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly trail = signal<Trail | null>(null);
  protected readonly trailError = signal<string | null>(null);
  protected readonly limitKph = computed(() => this.preferences.settings()?.speedLimitKph ?? 90);
  protected readonly trailPoints = computed(() => {
    const trail = this.trail();
    return trail && trail.vehicleId === this.selectedId() && trail.window === this.window()
      ? trail.points
      : [];
  });
  protected readonly lines = computed(() => trailLines(this.trailPoints(), this.limitKph()));
  /** The selected truck moves with its newest report, which is fresher than the fleet snapshot. */
  protected readonly trucks = computed<LiveTruck[]>(() => {
    const fleet = this.fleet();
    const trucks = fleet ? liveTrucks(fleet) : [];
    const point = this.trailPoints().at(-1);
    const position = mapCoordinates(point?.latitude, point?.longitude);
    return trucks.map((truck) =>
      truck.id === this.selectedId() &&
      point &&
      position &&
      (!truck.positionAt || point.recordedAt > truck.positionAt)
        ? {
            ...truck,
            position,
            positionAt: point.recordedAt,
            heading: point.headingDeg ?? truck.heading,
            speedKph: point.speedKph ?? truck.speedKph,
            odometerKm: point.odometerKm ?? truck.odometerKm,
            ignition: point.ignition ?? truck.ignition,
          }
        : truck,
    );
  });
  protected readonly selected = computed(
    () => this.trucks().find((truck) => truck.id === this.selectedId()) ?? null,
  );
  protected readonly routePosition = computed(() => {
    const point = this.routePoint();
    return mapCoordinates(point?.latitude, point?.longitude);
  });
  /** Street View shows the truck's last position, or the route report the user clicked. */
  protected readonly streetView = computed(() => {
    const truck = this.selected();
    if (!truck) {
      return null;
    }
    const text = this.text();
    const point = this.routePoint();
    const routePosition = this.routePosition();
    if (point && routePosition) {
      return {
        route: true,
        position: routePosition,
        heading: point.headingDeg,
        label: interpolate(text.streetRoute, { plate: truck.plate }),
        detail: interpolate(text.streetRouteDetail, {
          time: this.format.dateTime(point.recordedAt, true),
          speed: this.format.speed(point.speedKph),
        }),
      };
    }
    return truck.position
      ? {
          route: false,
          position: truck.position,
          heading: truck.heading,
          label: interpolate(text.streetLive, { plate: truck.plate }),
          detail: interpolate(text.streetLiveDetail, {
            time: formatRelative(truck.positionAt, this.now(), this.language()),
            speed: this.format.speed(truck.speedKph),
          }),
        }
      : null;
  });
  private readonly selection = toObservable(
    computed(() => ({ id: this.selectedId(), window: this.window() })),
  ).pipe(
    distinctUntilChanged((left, right) => left.id === right.id && left.window === right.window),
  );
  private readonly refresh = new Subject<void>();

  constructor() {
    effect((onCleanup) => {
      const text = this.text();
      this.moduleInfo.set({ title: text.title, body: text.moduleInfo });
      onCleanup(() => {
        this.moduleInfo.set(null);
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.pollFleet();
    this.selection
      .pipe(
        switchMap(({ id }) => {
          this.detail.set(null);
          this.detailError.set(null);
          return id
            ? timer(0, detailEveryMs).pipe(
                filter(this.visible),
                exhaustMap(() =>
                  this.api.vehicle(id).pipe(
                    catchError((error: unknown) => {
                      this.detailError.set(requestError(error, this.text().detailError));
                      return EMPTY;
                    }),
                  ),
                ),
              )
            : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        this.detail.set(detail);
        this.detailError.set(null);
      });
    this.selection
      .pipe(
        switchMap(({ id, window }) => {
          this.trailError.set(null);
          this.trail.set(null);
          return id ? this.followTrail(id, window) : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected reload(): void {
    this.refresh.next();
  }

  protected select(id: string | null): void {
    if (id !== this.selectedId()) {
      this.follow.set(true);
      this.routePoint.set(null);
    }
    this.selectedId.set(id);
    this.writeUrl();
  }

  protected changeWindow(window: TrailWindow): void {
    this.routePoint.set(null);
    this.window.set(window);
    this.writeUrl();
  }

  protected selectRoutePoint(target: MapCoordinates): void {
    this.routePoint.set(nearestPoint(this.trailPoints(), target));
    this.streetMinimized.set(false);
  }

  private pollFleet(): void {
    merge(timer(0, fleetEveryMs).pipe(filter(this.visible)), this.refresh)
      .pipe(
        exhaustMap(() => {
          this.now.set(this.wallClock());
          return this.api.fleet().pipe(
            catchError((error: unknown) => {
              this.fleetError.set(requestError(error, this.text().loadError));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((fleet) => {
        this.fleet.set(fleet);
        this.fleetError.set(null);
      });
  }

  /** Loads the whole window once, then appends the newer reports every 10 s. */
  private followTrail(vehicleId: string, window: TrailWindow): Observable<unknown> {
    const timeZone = this.preferences.settings()?.timeZone ?? 'UTC';
    const start = () => trailStart(window, new Date(this.wallClock()), timeZone);
    const to = () => new Date(this.wallClock()).toISOString();
    return this.api.track(vehicleId, start(), to()).pipe(
      tap((series) => {
        this.trail.set({ vehicleId, window, points: series.items, truncated: series.truncated });
      }),
      switchMap(() =>
        timer(trailEveryMs, trailEveryMs).pipe(
          filter(this.visible),
          exhaustMap(() =>
            this.api
              .track(vehicleId, this.trail()?.points.at(-1)?.recordedAt ?? start(), to())
              .pipe(
                map((series) => series.items),
                catchError(() => EMPTY),
              ),
          ),
        ),
      ),
      tap((points) => {
        this.appendTrail(vehicleId, window, points, start());
      }),
      catchError((error: unknown) => {
        this.trailError.set(requestError(error, this.text().trailError));
        return EMPTY;
      }),
    );
  }

  private appendTrail(
    vehicleId: string,
    window: TrailWindow,
    points: readonly TrailPoint[],
    earliest: string,
  ): void {
    this.now.set(this.wallClock());
    const fresh = points.filter((point) => point.recordedAt >= earliest);
    if (!fresh.length) {
      return;
    }
    this.trail.update((trail) =>
      trail && trail.vehicleId === vehicleId && trail.window === window
        ? {
            ...trail,
            points: mergeTrail(
              trail.points.filter((point) => point.recordedAt >= earliest),
              fresh,
            ),
          }
        : trail,
    );
  }

  private writeUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        truck: this.selectedId(),
        window: this.selectedId() && this.window() !== 'day' ? this.window() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
